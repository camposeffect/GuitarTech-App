import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import useCompanyData from "./UseCompanyData";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "./AuthProvider";

export default function FormularioRececao() {
  const { user } = useAuth(); // Obtém o usuário (empresa) autenticado
  const company = useCompanyData();

  // Estado do formulário
  const [form, setForm] = useState({
    cliente: "",
    contacto: "",
    tipoInstrumento: "",
    numeroServico: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    servicoEfetuar: "",
    servicos: [{ descricao: "", preco: "" }],
    produtos: [{ descricao: "", preco: "" }],
    dataEntrada: "",
    status: "em fila de espera",
  });

  // Para dropdown de clientes/instrumentos
  const [clientes, setClientes] = useState([]);
  const [clienteInput, setClienteInput] = useState("");
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [instrumentosDoCliente, setInstrumentosDoCliente] = useState([]);
  const [instrumentoSelecionado, setInstrumentoSelecionado] = useState("novo");

  // Carregar clientes relacionados à empresa logada
  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      const snap = await getDocs(
        query(collection(db, "empresas", user.uid, "clientes"))
      );
      setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    load();
  }, [user?.uid]);

  // Carregar instrumentos do cliente selecionado
  useEffect(() => {
    const loadInstr = async () => {
      setInstrumentosDoCliente([]);
      setInstrumentoSelecionado("novo");
      const c = clientes.find((c) => c.nome === form.cliente);
      if (!c) return;
      const snap = await getDocs(
        collection(db, "empresas", user.uid, "clientes", c.id, "instrumentos")
      );
      setInstrumentosDoCliente(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    loadInstr();
  }, [form.cliente, clientes]);

  const atualizarCampo = (e) => {
    const { name, value } = e.target;
    if (name === "cliente") {
      setClienteInput(value);
      setMostrarDropdown(true);
      setForm((prev) => ({ ...prev, cliente: value, contacto: "" }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const selecionarCliente = (c) => {
    setForm((prev) => ({ ...prev, cliente: c.nome, contacto: c.contacto || "" }));
    setClienteInput(c.nome);
    setMostrarDropdown(false);
  };

  const handleInstrumentoSelecao = (val) => {
    setInstrumentoSelecionado(val);
    if (val !== "novo") {
      const inst = instrumentosDoCliente.find((i) => i.id === val);
      setForm((prev) => ({
        ...prev,
        tipoInstrumento: inst.tipoInstrumento,
        marca: inst.marca,
        modelo: inst.modelo,
        numeroSerie: inst.numeroSerie,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        tipoInstrumento: "",
        marca: "",
        modelo: "",
        numeroSerie: "",
      }));
    }
  };

  const verificarOuCriarCliente = async (nome, contacto) => {
    const ref = collection(db, "empresas", user.uid, "clientes");
    const snap = await getDocs(
      query(ref, where("nome", "==", nome), where("contacto", "==", contacto))
    );

    if (!snap.empty) return snap.docs[0].id;

    // Criar o cliente associado ao UID da empresa (user.uid)
    const docRef = await addDoc(ref, {
      nome,
      contacto,
      uid: user.uid, // Associar o cliente ao UID da empresa logada
    });
    return docRef.id;
  };

  const guardarInstrumentoParaCliente = async (cid, inst) => {
    await addDoc(
      collection(db, "empresas", user.uid, "clientes", cid, "instrumentos"),
      inst
    );
  };

  const guardarNoHistorico = async () => {
    const totServ = form.servicos.reduce(
      (a, s) => a + parseFloat(s.preco || 0),
      0
    );
    const totProd = form.produtos.reduce(
      (a, p) => a + parseFloat(p.preco || 0),
      0
    );
    const precoTotal = totServ + totProd;
    await addDoc(collection(db, "empresas", user.uid, "servicos"), {
      ...form,
      dataEntrada: form.dataEntrada ? new Date(form.dataEntrada) : null,
      precoTotal,
      criadoEm: serverTimestamp(),
    });
  };

  const gerarPDFRececao = async () => {
    if (!company) {
      alert("A carregar dados da empresa...");
      return;
    }

    const doc = new jsPDF();
    doc.setFillColor(230, 230, 230);
    doc.rect(0, 0, 210, 50, "F");

    if (company.logoBase64) {
      doc.addImage(company.logoBase64, "PNG", 15, 10, 70, 25);
    }

    const direita = 195;
    doc.setFont("helvetica", "bold").setFontSize(14);
    if (company.nomeEmpresa) doc.text(company.nomeEmpresa, direita, 15, { align: "right" });

    doc.setFont("helvetica", "").setFontSize(11);
    let linhaY = 22;
    if (company.morada) {
      doc.text(company.morada, direita, linhaY, { align: "right" });
      linhaY += 5;
    }
    const local = `${company.codigoPostal || ""} ${company.localidade || ""}`.trim();
    if (local) {
      doc.text(local, direita, linhaY, { align: "right" });
      linhaY += 5;
    }
    if (company.contacto) {
      doc.text(`Telefone: ${company.contacto}`, direita, linhaY, { align: "right" });
      linhaY += 5;
    }
    if (company.email) {
      doc.text(`Email: ${company.email}`, direita, linhaY, { align: "right" });
      linhaY += 5;
    }
    if (company.nif) {
      doc.text(`NIF: ${company.nif}`, direita, linhaY, { align: "right" });
    }

    doc.setFontSize(16).setFont("helvetica", "bold");
    doc.text("Ficha de Receção de Instrumento", 105, 60, null, null, "center");

    const camposRececao = {
      cliente: "Cliente",
      numeroServico: "Número de Serviço",
      tipoInstrumento: "Instrumento",
      marca: "Marca",
      modelo: "Modelo",
      numeroSerie: "Número de Série",
      servicoEfetuar: "Serviço a Efetuar",
      dataEntrada: "Data de Entrada",
      servicos: "Serviços",
      produtos: "Produtos",
      precoTotal: "Preço Total"
    };

    let y = 75;
    doc.setFontSize(12);
    Object.entries(camposRececao).forEach(([key, label]) => {
      let valor = form[key] || "-";
      if (key === "servicos") {
        valor = form.servicos.map((s) => `${s.descricao} - ${s.preco}€`).join(", ");
      }
      if (key === "produtos") {
        valor = form.produtos.map((p) => `${p.descricao} - ${p.preco}€`).join(", ");
      }
      if (key === "precoTotal") {
        const totServ = form.servicos.reduce(
          (a, s) => a + parseFloat(s.preco || 0),
          0
        );
        const totProd = form.produtos.reduce(
          (a, p) => a + parseFloat(p.preco || 0),
          0
        );
        valor = `${(totServ + totProd).toFixed(2)}€`;
      }

      doc.setFont("helvetica", "bold").text(`${label}:`, 20, y);
      doc.setFont("helvetica", "");
      const linhas = doc.splitTextToSize(valor, 140);
      linhas.forEach((l, i) => doc.text(l, 65, y + i * 7));
      y += linhas.length * 7 + 3;
    });


    // Adiciona o disclaimer no rodapé
    y += 15;
    doc.setFontSize(10).setTextColor(150);
    doc.text("Preço dos serviços sem IVA incluído. O preço indicado é uma previsão, podendo ser necessário ajustes.", 20, y);

    doc.setDrawColor(150);
    doc.line(20, 280, 190, 280);
    doc.setFontSize(10).setTextColor(120);
    doc.save(`rececao_${form.cliente?.replace(/\s+/g, "_")}.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cid = await verificarOuCriarCliente(form.cliente, form.contacto);

      // Guardar instrumento novo, se aplicável
      if (instrumentoSelecionado === "novo") {
        await guardarInstrumentoParaCliente(cid, {
          tipoInstrumento: form.tipoInstrumento,
          marca: form.marca,
          modelo: form.modelo,
          numeroSerie: form.numeroSerie,
        });
      }

      await guardarNoHistorico();
      alert("Cliente, instrumento e histórico salvos com sucesso!");
      gerarPDFRececao(); // Garante que o PDF é gerado após salvar os dados
    } catch (err) {
      alert("Erro ao processar: " + err.message);
    }
  };

  const clientesFiltrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(clienteInput.toLowerCase())
  );

  // Função de atualizar valores nos campos dinâmicos
  const atualizarItem = (tipo, idx, field, v) => {
    setForm((prev) => ({
      ...prev,
      [tipo]: prev[tipo].map((it, i) =>
        i === idx ? { ...it, [field]: v } : it
      ),
    }));
  };

  // Funções para adicionar/remover serviços e produtos
  const adicionarItem = (tipo) => {
    setForm((prev) => ({
      ...prev,
      [tipo]: [...prev[tipo], { descricao: "", preco: "" }],
    }));
  };

  const removerItem = (tipo, idx) => {
    setForm((prev) => {
      const arr = [...prev[tipo]];
      arr.splice(idx, 1);
      return { ...prev, [tipo]: arr };
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-2xl shadow-xl relative">
      <h1 className="text-3xl font-bold text-center mb-6">Receção de Instrumento</h1>
      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
        {/* cliente com autocomplete */}
        <div className="flex flex-col relative">
          <label className="mb-2 font-medium text-gray-700">Cliente:</label>
          <input
            name="cliente"
            value={clienteInput}
            onChange={atualizarCampo}
            onFocus={() => setMostrarDropdown(true)}
            onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Digite ou selecione cliente"
          />
          {mostrarDropdown && clientesFiltrados.length > 0 && (
            <ul className="mt-1 bg-white border border-gray-300 w-full max-h-48 overflow-auto rounded-md shadow-lg">
              {clientesFiltrados.map((c) => (
                <li
                  key={c.id}
                  className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                  onMouseDown={() => selecionarCliente(c)}
                >
                  {c.nome} {c.contacto && `- ${c.contacto}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* contacto */}
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Contacto:</label>
          <input
            name="contacto"
            value={form.contacto}
            onChange={atualizarCampo}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Telefone ou email"
          />
        </div>

        {/* dropdown de instrumentos */}
        {instrumentosDoCliente.length > 0 && (
          <div className="flex flex-col">
            <label className="mb-2 font-medium text-gray-700">Instrumento do cliente:</label>
            <select
              value={instrumentoSelecionado}
              onChange={(e) => handleInstrumentoSelecao(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="novo">➡️ Novo instrumento</option>
              {instrumentosDoCliente.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.tipoInstrumento} — {inst.marca} {inst.modelo} ({inst.numeroSerie})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* campos instrumentais */}
        {["tipoInstrumento", "numeroServico", "marca", "modelo", "numeroSerie"].map((name) => (
          <div key={name} className="flex flex-col">
            <label className="mb-2 font-medium text-gray-700">
              {{
                tipoInstrumento: "Tipo de Instrumento",
                numeroServico: "Número de Serviço",
                numeroSerie: "Número de Série",
              }[name] || name.charAt(0).toUpperCase() + name.slice(1)}:
            </label>
            <input
              name={name}
              value={form[name]}
              onChange={atualizarCampo}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        {/* serviço a efetuar */}
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Serviço a Efetuar:</label>
          <textarea
            name="servicoEfetuar"
            value={form.servicoEfetuar}
            onChange={atualizarCampo}
            rows={3}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* serviços */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <h2 className="font-semibold mb-2">Serviços</h2>
          {form.servicos.map((s, i) => (
            <div key={`serv-${i}`} className="flex gap-3 mb-3 items-center">
              <input
                placeholder="Descrição"
                value={s.descricao}
                onChange={(e) => atualizarItem("servicos", i, "descricao", e.target.value)}
                className="flex-2 p-3 border border-gray-300 rounded-lg"
              />
              <input
                placeholder="Preço"
                value={s.preco}
                type="number"
                step="0.01"
                onChange={(e) => atualizarItem("servicos", i, "preco", e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
              {form.servicos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerItem("servicos", i)}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => adicionarItem("servicos")}
            className="px-4 py-2 bg-green-500 text-white rounded-lg"
          >
            Adicionar serviço
          </button>
        </div>

        {/* produtos */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <h2 className="font-semibold mt-6 mb-2">Produtos</h2>
          {form.produtos.map((p, i) => (
            <div key={`prod-${i}`} className="flex gap-3 mb-3 items-center">
              <input
                placeholder="Descrição"
                value={p.descricao}
                onChange={(e) => atualizarItem("produtos", i, "descricao", e.target.value)}
                className="flex-2 p-3 border border-gray-300 rounded-lg"
              />
              <input
                placeholder="Preço"
                value={p.preco}
                type="number"
                step="0.01"
                onChange={(e) => atualizarItem("produtos", i, "preco", e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
              <button
                type="button"
                onClick={() => removerItem("produtos", i)}
                className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => adicionarItem("produtos")}
            className="px-4 py-2 bg-green-500 text-white rounded-lg"
          >
            Adicionar produto
          </button>
        </div>

        {/* data entrada */}
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Data de Entrada:</label>
          <input
            type="date"
            name="dataEntrada"
            value={form.dataEntrada}
            onChange={atualizarCampo}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700"
        >
          Guardar e Gerar PDF
        </button>
      </form>
    </div>
  );
}
