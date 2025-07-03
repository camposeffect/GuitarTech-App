import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import useCompanyData from "./UseCompanyData";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

// Função para debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function FormularioEntrega() {
  const [formEntrega, setFormEntrega] = useState({
    cliente: "",
    numeroServico: "",
    tipoInstrumento: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    servicoEfetuado: "",
    upgrades: "",
    outros: "",
    cordasAplicadas: "",
    afinacao: "",
    acao12LowE: "",
    acao12HighE: "",
    acao1Fret: "",
    alturaPickups: "",
    dataEntrega: "",
  });

  const [isServicoEntregue, setIsServicoEntregue] = useState(false); // Variável de estado para saber se o serviço está entregue
  const company = useCompanyData(); // Obtém os dados da empresa

  const atualizarCampo = (e) => {
    const { name, value } = e.target;
    setFormEntrega((prev) => ({ ...prev, [name]: value }));
  };

  // Utilizando debounce para o número do serviço
  const debouncedNumeroServico = useDebounce(formEntrega.numeroServico, 500);

  useEffect(() => {
    const fetchServico = async () => {
      const num = debouncedNumeroServico.trim();
      if (!num || !company) return;

      const servRef = collection(db, "empresas", company.userUid, "servicos");
      const q = query(servRef, where("numeroServico", "==", num));
      const snaps = await getDocs(q);

      if (!snaps.empty) {
        const data = snaps.docs[0].data();

        // Verifica o status do serviço e desabilita o preenchimento se estiver "entregue"
        if (data.status === "entregue") {
          setIsServicoEntregue(true);
          alert("Este serviço já está marcado como 'Entregue' e não pode ser editado.");
        } else {
          setIsServicoEntregue(false);
          setFormEntrega((prev) => ({
            ...prev,
            cliente: data.cliente || prev.cliente,
            tipoInstrumento: data.tipoInstrumento || prev.tipoInstrumento,
            marca: data.marca || prev.marca,
            modelo: data.modelo || prev.modelo,
            numeroSerie: data.numeroSerie || prev.numeroSerie,
            servicoEfetuado: data.servicoEfetuar || prev.servicoEfetudo,
          }));
        }
      }
    };

    fetchServico();
  }, [debouncedNumeroServico, company]);

  const guardarSetupNoInstrumento = async () => {
    try {
      if (!formEntrega.numeroSerie) {
        alert("Número de série é obrigatório.");
        return false;
      }

      if (!company || !company.userUid) {
        alert("Dados da empresa não encontrados.");
        return false;
      }

      console.log("Buscando pelo número de série:", formEntrega.numeroSerie);
      console.log("Company UID:", company.userUid);

      // Buscar o cliente pelo nome
      const clientesRef = collection(db, "empresas", company.userUid, "clientes");
      const clientesSnap = await getDocs(clientesRef);
      let clienteId = null;

      // Encontrar o ID do cliente
      clientesSnap.forEach(doc => {
        const clienteData = doc.data();
        if (clienteData.nome === formEntrega.cliente) {
          clienteId = doc.id;
        }
      });

      if (!clienteId) {
        alert("Cliente não encontrado.");
        return false;
      }

      console.log("Cliente encontrado:", clienteId);

      // Buscar o instrumento do cliente pelo número de série
      const instrumentosRef = collection(db, "empresas", company.userUid, "clientes", clienteId, "instrumentos");
      const q = query(instrumentosRef, where("numeroSerie", "==", formEntrega.numeroSerie));
      const instrumentosSnap = await getDocs(q);

      if (instrumentosSnap.empty) {
        console.log("Nenhum instrumento encontrado com esse número de série.");
        alert("Nenhum instrumento encontrado com esse número de série.");
        return false;
      }

      console.log("Instrumentos encontrados:", instrumentosSnap.docs.length);

      // Atualizar o instrumento encontrado
      const instrumentoDoc = instrumentosSnap.docs[0];
      const instrumentoDocRef = instrumentoDoc.ref;

      // Atualizar ou criar histórico de serviços
      const servicosAnteriores = instrumentoDoc.data().servicosAnteriores || [];

      await updateDoc(instrumentoDocRef, {
        servicosAnteriores: arrayUnion({
          dataEntrega: formEntrega.dataEntrega || new Date().toISOString().split("T")[0],
          servicoEfetuado: formEntrega.servicoEfetuado,
          upgrades: formEntrega.upgrades,
          outros: formEntrega.outros,
          cordasAplicadas: formEntrega.cordasAplicadas,
          afinacao: formEntrega.afinacao,
          acao12LowE: formEntrega.acao12LowE,
          acao12HighE: formEntrega.acao12HighE,
          acao1Fret: formEntrega.acao1Fret,
          alturaPickups: formEntrega.alturaPickups,
        }),
      });

      console.log("Serviço atualizado com sucesso!");
      alert("Serviço atualizado com sucesso!");
      return true;
    } catch (error) {
      console.error("Erro ao guardar setup no Firestore:", error);
      alert("Erro ao guardar setup no Firestore. Verifique a conexão.");
      return false;
    }
  };

  const gerarPDFEntrega = async () => {
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
    doc.text("Relatório do Guitar Tech", 105, 60, null, null, "center");

    const camposEntrega = {
      cliente: "Cliente",
      numeroServico: "Número de Serviço",
      tipoInstrumento: "Instrumento",
      marca: "Marca",
      modelo: "Modelo",
      numeroSerie: "Número de Série",
      servicoEfetuado: "Serviço efetuado",
      upgrades: "Upgrades",
      outros: "Outros",
      cordasAplicadas: "Cordas aplicadas",
      afinacao: "Afinação",
      acao12LowE: "Ação 12º fret E grave",
      acao12HighE: "Ação 12º fret E aguda",
      acao1Fret: "Ação 1º traste",
      alturaPickups: "Altura dos pickups",
      dataEntrega: "Data de Entrega",
    };

    let y = 75;
    doc.setFontSize(12);
    Object.entries(camposEntrega).forEach(([key, label]) => {
      const valor = formEntrega[key] || "-";
      doc.setFont("helvetica", "bold").text(`${label}:`, 20, y);
      doc.setFont("helvetica", "");
      const linhas = doc.splitTextToSize(valor, 140);
      linhas.forEach((l, i) => doc.text(l, 65, y + i * 7));
      y += linhas.length * 7 + 3;
    });

    y += 15;
    doc.setFont("helvetica", "bold").text("O Guitar Tech", 20, y);
    doc.line(60, y + 2, 150, y + 2);
    doc.setDrawColor(150);
    doc.line(20, 280, 190, 280);
    doc.setFontSize(10).setTextColor(120);
    doc.save(`entrega_${formEntrega.cliente?.replace(/\s+/g, "_")}.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sucesso = await guardarSetupNoInstrumento();
    if (sucesso) {
      await gerarPDFEntrega(); // Garante que o PDF é gerado após salvar os dados
    } else {
      alert("Erro ao processar os dados.");
    }
  };

  const gruposCampos = [
    {
      titulo: "Cliente e Serviço",
      campos: ["cliente", "numeroServico", "dataEntrega"],
    },
    {
      titulo: "Instrumento",
      campos: ["tipoInstrumento", "marca", "modelo", "numeroSerie"],
    },
    {
      titulo: "Serviços e Upgrades",
      campos: ["servicoEfetuado", "upgrades", "outros"],
    },
    {
      titulo: "Setup Final",
      campos: [
        "cordasAplicadas",
        "afinacao",
        "acao12LowE",
        "acao12HighE",
        "acao1Fret",
        "alturaPickups",
      ],
    },
  ];

  const labelsPersonalizadas = {
    cliente: "Cliente",
    numeroServico: "Número de Serviço",
    tipoInstrumento: "Tipo de Instrumento",
    marca: "Marca",
    modelo: "Modelo",
    numeroSerie: "Número de Série",
    servicoEfetuado: "Serviço efetuado",
    upgrades: "Upgrades",
    outros: "Outros",
    cordasAplicadas: "Cordas aplicadas",
    afinacao: "Afinação",
    acao12LowE: "Ação 12º fret E grave",
    acao12HighE: "Ação 12º fret E aguda",
    acao1Fret: "Ação 1º traste",
    alturaPickups: "Altura dos pickups",
    dataEntrega: "Data de Entrega",
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-50 py-10 px-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white p-8 rounded-xl shadow-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Entrega de Instrumento
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {gruposCampos.map((grupo) => (
            <div key={grupo.titulo}>
              <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-1">
                {grupo.titulo}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {grupo.campos.map((campo) => {
                  const label = labelsPersonalizadas[campo] || campo;
                  const isTextarea = ["servicoEfetuado", "upgrades", "outros"].includes(campo);
                  const isDate = campo === "dataEntrega";
                  return (
                    <div key={campo} className="flex flex-col">
                      <label htmlFor={campo} className="mb-1 font-medium text-gray-700">
                        {label}
                      </label>
                      {isTextarea ? (
                        <textarea
                          id={campo}
                          name={campo}
                          value={formEntrega[campo]}
                          onChange={atualizarCampo}
                          rows={3}
                          className="resize-y p-3 border border-gray-300 rounded-md"
                          disabled={isServicoEntregue} // Desabilitar se o serviço estiver entregue
                        />
                      ) : (
                        <input
                          id={campo}
                          name={campo}
                          type={isDate ? "date" : "text"}
                          value={formEntrega[campo]}
                          onChange={atualizarCampo}
                          className="p-3 border border-gray-300 rounded-md"
                          disabled={isServicoEntregue} // Desabilitar se o serviço estiver entregue
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={!company || isServicoEntregue}
            className={`w-full py-3 font-semibold rounded-lg shadow-md text-white transition-colors ${
              company && !isServicoEntregue ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {company && !isServicoEntregue ? "Guardar e Gerar PDF" : "Serviço já entregue"}
          </button>
        </form>
      </div>
    </div>
  );
}
