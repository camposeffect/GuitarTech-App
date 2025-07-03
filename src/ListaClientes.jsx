import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import useCompanyData from "./UseCompanyData";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "./AuthProvider";

export default function FormularioRececao() {
  const { user } = useAuth();
  const company = useCompanyData();

  // Estado clientes carregados do Firestore
  const [clientes, setClientes] = useState([]);

  // Estado para saber se está criando cliente novo
  const [novoCliente, setNovoCliente] = useState(false);

  const [form, setForm] = useState({
    clienteId: "", // id do cliente selecionado
    cliente: "", // nome cliente (novo)
    contacto: "", // contacto cliente (novo)
    tipoInstrumento: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    numeroServico: "",
    servicoEfetuar: "",
    servicos: [{ descricao: "", preco: "" }],
    produtos: [],
    dataEntrada: "",
    status: "em fila de espera",
  });

  // Carregar clientes da empresa no Firestore
  useEffect(() => {
    if (!user?.uid) return;
    async function carregarClientes() {
      const clientesCol = collection(db, "empresas", user.uid, "clientes");
      const snapshot = await getDocs(clientesCol);
      setClientes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }
    carregarClientes();
  }, [user]);

  const atualizarCampo = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const atualizarItem = (tipo, index, field, value) => {
    setForm((prev) => {
      const atualizados = prev[tipo].map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      );
      return { ...prev, [tipo]: atualizados };
    });
  };

  const adicionarItem = (tipo) =>
    setForm((prev) => ({
      ...prev,
      [tipo]: [...prev[tipo], { descricao: "", preco: "" }],
    }));

  const removerItem = (tipo, index) =>
    setForm((prev) => {
      const atualizados = [...prev[tipo]];
      atualizados.splice(index, 1);
      return { ...prev, [tipo]: atualizados };
    });

  // Quando seleciona cliente existente, preencher nome/contacto automaticamente no form para visualização/edit
  const handleSelecionarCliente = (e) => {
    const clienteId = e.target.value;
    setForm((prev) => ({
      ...prev,
      clienteId,
      cliente: "",
      contacto: "",
      tipoInstrumento: "",
      marca: "",
      modelo: "",
      numeroSerie: "",
    }));
    setNovoCliente(false);
    if (clienteId) {
      const c = clientes.find((c) => c.id === clienteId);
      if (c) {
        setForm((prev) => ({
          ...prev,
          clienteId: c.id,
          cliente: c.cliente || c.nome || "",
          contacto: c.contacto || "",
        }));
      }
    }
  };

  // Alternar para criar cliente novo
  const handleNovoCliente = () => {
    setNovoCliente(true);
    setForm((prev) => ({
      ...prev,
      clienteId: "",
      cliente: "",
      contacto: "",
      tipoInstrumento: "",
      marca: "",
      modelo: "",
      numeroSerie: "",
    }));
  };

  // Salvar cliente e instrumento (se novo cliente)
  async function salvarClienteEInstrumento() {
    if (!user?.uid) throw new Error("Usuário não autenticado");

    // Valida nome e contacto cliente
    if (!form.cliente.trim()) throw new Error("Nome do cliente obrigatório");
    if (!form.contacto.trim()) throw new Error("Contacto do cliente obrigatório");

    // Cria cliente no Firestore
    const clientesRef = collection(db, "empresas", user.uid, "clientes");
    const docCliente = await addDoc(clientesRef, {
      cliente: form.cliente.trim(),
      contacto: form.contacto.trim(),
      criadoEm: serverTimestamp(),
    });

    // Cria instrumento vinculado ao cliente
    const instrumentosRef = collection(db, "empresas", user.uid, "clientes", docCliente.id, "instrumentos");
    await addDoc(instrumentosRef, {
      tipoInstrumento: form.tipoInstrumento.trim(),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      numeroSerie: form.numeroSerie.trim(),
      dataEntrada: form.dataEntrada ? new Date(form.dataEntrada) : null,
      criadoEm: serverTimestamp(),
    });

    return docCliente.id;
  }

  // Salvar receção associada ao cliente e ao instrumento
  async function guardarNoHistorico(clienteId) {
    if (!user?.uid) throw new Error("Usuário não autenticado");

    const totalServicos = form.servicos.reduce(
      (acc, s) => acc + parseFloat(s.preco || 0),
      0
    );
    const totalProdutos = form.produtos.reduce(
      (acc, p) => acc + parseFloat(p.preco || 0),
      0
    );
    const precoTotal = totalServicos + totalProdutos;

    // Guardar receção no Firestore
    const servicosRef = collection(db, "empresas", user.uid, "servicos");
    await addDoc(servicosRef, {
      clienteId,
      clienteNome: form.cliente,
      contacto: form.contacto,
      tipoInstrumento: form.tipoInstrumento,
      marca: form.marca,
      modelo: form.modelo,
      numeroSerie: form.numeroSerie,
      numeroServico: form.numeroServico,
      servicoEfetuar: form.servicoEfetuar,
      servicos: form.servicos,
      produtos: form.produtos,
      dataEntrada: form.dataEntrada ? new Date(form.dataEntrada) : null,
      status: form.status,
      precoTotal,
      criadoEm: serverTimestamp(),
    });
  }

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(220, 220, 220);
    doc.rect(0, 0, 210, 45, "F");
    if (company?.logoBase64)
      doc.addImage(company.logoBase64, "PNG", 10, 10, 70, 25);

    const direita = 200;
    doc.setFont("helvetica", "normal").setFontSize(12);
    let ylinha = 15;
    ["nomeEmpresa", "morada", "contacto", "email", "nif"].forEach((k) => {
      if (company?.[k]) {
        doc.text(
          k === "email"
            ? `Email: ${company[k]}`
            : k === "contacto"
            ? `Telefone: ${company[k]}`
            : company[k],
          direita,
          ylinha,
          { align: "right" }
        );
        ylinha += 7;
      }
    });

    doc.setFontSize(16).setFont("helvetica", "bold");
    doc.text("Ficha de Receção de Instrumento", 105, 55, { align: "center" });
    doc.setFontSize(12).setFont("helvetica", "normal");

    let y = 65;
    const campos = [
      { key: "cliente", label: "Cliente" },
      { key: "tipoInstrumento", label: "Instrumento" },
      { key: "numeroServico", label: "Nº de Serviço" },
      { key: "marca", label: "Marca" },
      { key: "modelo", label: "Modelo" },
      { key: "numeroSerie", label: "Nº de Série" },
      { key: "servicoEfetuar", label: "Serviço a Efetuar" },
      { key: "dataEntrada", label: "Data de Entrada" },
    ];

    campos.forEach(({ key, label }) => {
      const texto = form[key] || "-";
      const linhas = doc.splitTextToSize(texto, 130);
      doc.setFont("helvetica", "bold").text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      linhas.forEach((l, i) => doc.text(l, 60, y + i * 8));
      y += Math.max(linhas.length * 8, 10);
    });

    const totalServicos = form.servicos.reduce(
      (acc, s) => acc + parseFloat(s.preco || 0),
      0
    );
    const totalProdutos = form.produtos.reduce(
      (acc, p) => acc + parseFloat(p.preco || 0),
      0
    );

    y += 10;
    doc.setFont("helvetica", "bold").text("Serviços", 20, y);
    y += 7;
    form.servicos.forEach((s) => {
      doc
        .setFont("helvetica", "normal")
        .text(`${s.descricao} — €${s.preco || "0.00"}`, 30, y);
      y += 7;
    });

    y += 10;
    if (form.produtos.length > 0) {
      doc.setFont("helvetica", "bold").text("Produtos", 20, y);
      y += 7;
      form.produtos.forEach((p) => {
        doc
          .setFont("helvetica", "normal")
          .text(`${p.descricao} — €${p.preco || "0.00"}`, 30, y);
        y += 7;
      });
    }

    let yTotais = y + 5;
    doc
      .setFont("helvetica", "bold")
      .text(`Total Serviços: €${totalServicos.toFixed(2)}`, 20, yTotais);
    if (form.produtos.length > 0) {
      doc.text(`Total Produtos: €${totalProdutos.toFixed(2)}`, 20, yTotais + 7);
      doc.text(
        `Total Geral: €${(totalServicos + totalProdutos).toFixed(2)}`,
        20,
        yTotais + 14
      );
      yTotais += 14;
    }

    doc
      .setFont("helvetica", "italic")
      .setTextColor(80)
      .text("Valores sem IVA incluído", 20, yTotais + 10);
    doc.save(`rececao_${form.cliente.replace(/\s+/g, "_")}.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let clienteId = form.clienteId;

      if (novoCliente) {
        clienteId = await salvarClienteEInstrumento();
        alert("Cliente e instrumento criados com sucesso!");
      } else if (!clienteId) {
        alert("Selecione um cliente ou crie um novo");
        return;
      }

      // Se cliente existente, só salvar a receção (pode criar instrumento no futuro em outro lugar)
      await guardarNoHistorico(clienteId);

      alert("Receção guardada com sucesso!");
      gerarPDF();

      // Resetar form
      setForm({
        clienteId: "",
        cliente: "",
        contacto: "",
        tipoInstrumento: "",
        marca: "",
        modelo: "",
        numeroSerie: "",
        numeroServico: "",
        servicoEfetuar: "",
        servicos: [{ descricao: "", preco: "" }],
        produtos: [],
        dataEntrada: "",
        status: "em fila de espera",
      });
      setNovoCliente(false);
    } catch (err) {
      alert("Erro ao guardar: " + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Receção de Instrumentos</h2>

      <label>
        Cliente:
        <select
          value={form.clienteId}
          onChange={handleSelecionarCliente}
          disabled={novoCliente}
          required={!novoCliente}
        >
          <option value="">-- Selecionar cliente --</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cliente || c.nome}
            </option>
          ))}
        </select>
      </label>

      {!novoCliente && (
        <button type="button" onClick={handleNovoCliente}>
          + Criar Novo Cliente
        </button>
      )}

      {novoCliente && (
        <>
          <label>
            Nome do Cliente:
            <input
              type="text"
              name="cliente"
              value={form.cliente}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Contacto:
            <input
              type="text"
              name="contacto"
              value={form.contacto}
              onChange={atualizarCampo}
              required
            />
          </label>

          <h3>Instrumento</h3>
          <label>
            Tipo:
            <input
              type="text"
              name="tipoInstrumento"
              value={form.tipoInstrumento}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Marca:
            <input
              type="text"
              name="marca"
              value={form.marca}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Modelo:
            <input
              type="text"
              name="modelo"
              value={form.modelo}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Nº de Série:
            <input
              type="text"
              name="numeroSerie"
              value={form.numeroSerie}
              onChange={atualizarCampo}
            />
          </label>
        </>
      )}

      {/*
      Se cliente EXISTENTE, mostrar os campos do instrumento para preencher
      O ideal seria permitir depois adicionar instrumentos no perfil do cliente,
      mas pra já deixo assim simples
      */}
      {!novoCliente && form.clienteId && (
        <>
          <h3>Instrumento</h3>
          <label>
            Tipo:
            <input
              type="text"
              name="tipoInstrumento"
              value={form.tipoInstrumento}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Marca:
            <input
              type="text"
              name="marca"
              value={form.marca}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Modelo:
            <input
              type="text"
              name="modelo"
              value={form.modelo}
              onChange={atualizarCampo}
              required
            />
          </label>
          <label>
            Nº de Série:
            <input
              type="text"
              name="numeroSerie"
              value={form.numeroSerie}
              onChange={atualizarCampo}
            />
          </label>
        </>
      )}

      <label>
        Nº de Serviço:
        <input
          type="text"
          name="numeroServico"
          value={form.numeroServico}
          onChange={atualizarCampo}
        />
      </label>

      <label>
        Serviço a Efetuar:
        <input
          type="text"
          name="servicoEfetuar"
          value={form.servicoEfetuar}
          onChange={atualizarCampo}
        />
      </label>

      <label>
        Data de Entrada:
        <input
          type="date"
          name="dataEntrada"
          value={form.dataEntrada}
          onChange={atualizarCampo}
        />
      </label>

      <fieldset>
        <legend>Serviços</legend>
        {form.servicos.map((s, i) => (
          <div key={i}>
            <input
              type="text"
              placeholder="Descrição"
              value={s.descricao}
              onChange={(e) =>
                atualizarItem("servicos", i, "descricao", e.target.value)
              }
              required
            />
            <input
              type="number"
              placeholder="Preço"
              min="0"
              step="0.01"
              value={s.preco}
              onChange={(e) =>
                atualizarItem("servicos", i, "preco", e.target.value)
              }
              required
            />
            {form.servicos.length > 1 && (
              <button type="button" onClick={() => removerItem("servicos", i)}>
                Remover
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => adicionarItem("servicos")}>
          + Adicionar Serviço
        </button>
      </fieldset>

      <fieldset>
        <legend>Produtos</legend>
        {form.produtos.map((p, i) => (
          <div key={i}>
            <input
              type="text"
              placeholder="Descrição"
              value={p.descricao}
              onChange={(e) =>
                atualizarItem("produtos", i, "descricao", e.target.value)
              }
            />
            <input
              type="number"
              placeholder="Preço"
              min="0"
              step="0.01"
              value={p.preco}
              onChange={(e) =>
                atualizarItem("produtos", i, "preco", e.target.value)
              }
            />
            {form.produtos.length > 0 && (
              <button type="button" onClick={() => removerItem("produtos", i)}>
                Remover
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => adicionarItem("produtos")}>
          + Adicionar Produto
        </button>
      </fieldset>

      <button type="submit">Guardar</button>
    </form>
  );
}
