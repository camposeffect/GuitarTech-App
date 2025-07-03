import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "./AuthProvider";

function ActionButton({ type, onClick, children }) {
  const baseClass =
    "px-2 py-1 rounded text-white text-xs font-medium mr-1 transition";

  const colorClass =
    type === "editar"
      ? "bg-blue-600 hover:bg-blue-700"
      : type === "salvar"
      ? "bg-green-600 hover:bg-green-700"
      : type === "apagar"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-gray-600 hover:bg-gray-700";

  return (
    <button onClick={onClick} type="button" className={`${baseClass} ${colorClass}`}>
      {children}
    </button>
  );
}

function Modal({ isOpen, onClose, onConfirm, telefoneCliente, isDeleteModal, onDeleteConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
        {isDeleteModal ? (
          <>
            <h2 className="text-lg font-semibold mb-4">Confirmar Exclusão</h2>
            <p className="mb-4">Tem certeza de que deseja apagar este serviço?</p>
            <div className="flex justify-end gap-4">
              <ActionButton type="default" onClick={onClose}>Cancelar</ActionButton>
              <ActionButton
                type="apagar"
                onClick={() => {
                  onDeleteConfirm();
                  onClose();
                }}
              >
                Confirmar
              </ActionButton>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4">Enviar Notificação via WhatsApp</h2>
            <p className="mb-4">Deseja enviar uma mensagem ao cliente via WhatsApp para informá-lo que o serviço está pronto para entrega?</p>
            <div className="flex justify-end gap-4">
              <ActionButton type="default" onClick={onClose}>Cancelar</ActionButton>
              <ActionButton
                type="salvar"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                Confirmar
              </ActionButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatarData(data) {
  if (!data) return "-";
  const d = data.toDate ? data.toDate() : new Date(data);
  return d.toLocaleDateString("pt-PT");
}

function formatarDataInput(data) {
  if (!data) return "";
  const d = data.toDate ? data.toDate() : new Date(data);
  return d.toISOString().split("T")[0];
}

export default function HistoricoServicos() {
  const { user } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [sortField, setSortField] = useState("criadoEm");
  const [sortDirection, setSortDirection] = useState("desc");

  const [isModalOpen, setIsModalOpen] = useState(false); // Para controle do modal
  const [telefoneCliente, setTelefoneCliente] = useState(""); // Para armazenar o telefone do cliente
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Controle do modal de deletação
  const [serviceToDelete, setServiceToDelete] = useState(null); // Serviço a ser deletado

  const [mensagemWhatsapp, setMensagemWhatsapp] = useState(""); // Para armazenar a mensagem de WhatsApp
  const [enviarMensagemWhatsapp, setEnviarMensagemWhatsapp] = useState(false); // Para armazenar se o envio está habilitado

  useEffect(() => {
    if (!user) return;

    // Buscar dados de configuração da empresa
    const fetchConfigData = async () => {
      const empresaRef = doc(db, "empresas", user.uid);
      const empresaDoc = await getDoc(empresaRef);
      if (empresaDoc.exists()) {
        const data = empresaDoc.data();
        setMensagemWhatsapp(data.mensagemWhatsapp || "");
        setEnviarMensagemWhatsapp(data.enviarMensagemWhatsapp || false);
      }
    };

    // Buscar os serviços
    const q = query(
      collection(db, "empresas", user.uid, "servicos"),
      orderBy("criadoEm", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setServicos(lista);
      setLoading(false);
    });

    fetchConfigData(); // Buscar as configurações

    return () => unsubscribe();
  }, [user]);

  const atualizarCampo = (e) => {
    const { name, value } = e.target;
    
    if (name === 'produtos' || name === 'servicos') {
      const updatedItems = value.split(",").map(item => ({
        preco: item.trim()
      }));
      setFormEdit((prev) => ({ ...prev, [name]: updatedItems }));
    } else {
      setFormEdit((prev) => ({ ...prev, [name]: value }));
    }
  };

  const editarServico = (servico) => {
    // Calcular os totais de serviços e produtos
    const totalServicos = Array.isArray(servico.servicos)
      ? servico.servicos.reduce((acc, s) => acc + parseFloat(s.preco || 0), 0)
      : 0;

    const totalProdutos = Array.isArray(servico.produtos)
      ? servico.produtos.reduce((acc, item) => acc + parseFloat(item.preco || 0), 0)
      : 0;

    const precoTotal = totalServicos + totalProdutos;

    setEditandoId(servico.id);
    setFormEdit({
      ...servico,
      dataEntrada: formatarDataInput(servico.dataEntrada),
      dataEntrega: formatarDataInput(servico.dataEntrega),
      precoTotal: precoTotal.toFixed(2), // Adicionar campo precoTotal para edição
      produtos: servico.produtos || [], // Adicionar a lista de produtos para edição
      servicos: servico.servicos || [], // Adicionar a lista de serviços para edição
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setFormEdit({});
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;

    try {
      // Calcular o novo preço total
      const totalServicos = Array.isArray(formEdit.servicos)
        ? formEdit.servicos.reduce((acc, item) => acc + parseFloat(item.preco || 0), 0)
        : 0;

      const totalProdutos = Array.isArray(formEdit.produtos)
        ? formEdit.produtos.reduce((acc, item) => acc + parseFloat(item.preco || 0), 0)
        : 0;

      // Preço total (somando serviços + produtos)
      const precoTotal = (totalServicos + totalProdutos).toFixed(2);

      // Atualizar o serviço no banco de dados
      const docRef = doc(db, "empresas", user.uid, "servicos", editandoId);
      const dados = {
        ...formEdit,
        precoTotal: precoTotal, // Atualizar preço total (somando serviços + produtos)
        dataEntrada: formEdit.dataEntrada ? Timestamp.fromDate(new Date(formEdit.dataEntrada)) : null,
        dataEntrega: formEdit.dataEntrega ? Timestamp.fromDate(new Date(formEdit.dataEntrega)) : null,
      };

      // Salvar no Firestore
      await updateDoc(docRef, dados);

      // Atualizar a lista de serviços no estado local
      setServicos((prevServicos) =>
        prevServicos.map((s) =>
          s.id === editandoId
            ? {
                ...s,
                ...dados, // Atualizar o serviço com os novos dados
                precoTotal, // Atualizar o preço total
              }
            : s
        )
      );

      cancelarEdicao(); // Fechar o modo de edição
    } catch (err) {
      alert("Erro ao salvar edição: " + err.message);
    }
  };

  const apagarServico = async (id) => {
    try {
      const docRef = doc(db, "empresas", user.uid, "servicos", id);
      await deleteDoc(docRef);

      setServicos((prevServicos) => prevServicos.filter((servico) => servico.id !== id));
    } catch (err) {
      alert("Erro ao apagar serviço: " + err.message);
    }
  };

  const atualizarStatus = async (id, novoStatus, telefoneCliente) => {
    try {
      const docRef = doc(db, "empresas", user.uid, "servicos", id);
      await updateDoc(docRef, { status: novoStatus });

      if (novoStatus === "pronto para entrega" && enviarMensagemWhatsapp) {
        setTelefoneCliente(telefoneCliente); // Define o telefone do cliente
        setIsModalOpen(true); // Abre o modal
      }
    } catch (err) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const toggleSort = (field) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedServicos = [...servicos].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === undefined || bVal === undefined) return 0;

    const aValue = typeof aVal === "string" ? aVal.toLowerCase() : aVal;
    const bValue = typeof bVal === "string" ? bVal.toLowerCase() : bVal;

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const renderHeader = (label, field) => (
    <th
      onClick={() => toggleSort(field)}
      className="bg-gray-100 text-center px-4 py-3 cursor-pointer select-none whitespace-nowrap text-sm font-medium hover:bg-gray-200 transition"
    >
      {label} {sortField === field ? (sortDirection === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  const calcularPrecoTotal = (s) => {
    const totalServicos = Array.isArray(s.servicos)
      ? s.servicos.reduce((acc, item) => acc + parseFloat(item.preco || 0), 0)
      : 0;

    const totalProdutos = Array.isArray(s.produtos)
      ? s.produtos.reduce((acc, item) => acc + parseFloat(item.preco || 0), 0)
      : 0;

    return (totalServicos + totalProdutos).toFixed(2) + "€";
  };

  if (loading) return <p>Carregando histórico de serviços...</p>;
  if (servicos.length === 0) return <p>Nenhum serviço registrado ainda.</p>;

  return (
    <div className="w-full max-w-full mx-auto px-4 overflow-x-auto mt-6">
      <h2 className="text-xl font-semibold mb-4">Histórico de Serviços</h2>
      <table className="w-full table-auto border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr>
            {renderHeader("Nº Serviço", "numeroServico")}
            {renderHeader("Cliente", "cliente")}
            {renderHeader("Contacto", "contacto")}
            {renderHeader("Tipo Instrumento", "tipoInstrumento")}
            {renderHeader("Marca", "marca")}
            {renderHeader("Modelo", "modelo")}
            {renderHeader("Nº Série", "numeroSerie")}
            {renderHeader("Serviço", "servicoEfetuar")}
            <th className="bg-gray-100 text-center px-4 py-3">Preço</th>
            <th className="bg-gray-100 text-center px-4 py-3">Produtos</th>
            {renderHeader("Preço Total", "precoTotal")}
            {renderHeader("Data Entrada", "dataEntrada")}
            {renderHeader("Status", "status")}
            {renderHeader("Data Entrega", "dataEntrega")}
            <th className="bg-gray-100 text-center px-4 py-3 min-w-[90px]">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sortedServicos.map((s, index) => {
            const isEven = index % 2 === 0;
            const statusClass =
              s.status === "entregue"
                ? "bg-green-600"
                : s.status === "a aguardar peças"
                ? "bg-yellow-500"
                : s.status === "pronto para entrega"
                ? "bg-blue-600"
                : s.status === "em manutenção"
                ? "bg-orange-500"
                : "bg-gray-700";

            return (
              <tr
                key={s.id}
                className={`${
                  isEven ? "bg-white" : "bg-gray-50"
                } hover:bg-slate-200 transition`}
              >
                {editandoId === s.id ? (
                  <>
                    {/* Campos editáveis */}
                    {[
                      "numeroServico",
                      "cliente",
                      "contacto",
                      "tipoInstrumento",
                      "marca",
                      "modelo",
                      "numeroSerie",
                      "servicoEfetuar",
                    ].map((field) => (
                      <td key={field} className="px-4 py-3 text-center max-w-xs break-words">
                        <input
                          name={field}
                          value={formEdit[field] || ""}
                          onChange={atualizarCampo}
                          className="w-full border px-2 py-1 rounded"
                        />
                      </td>
                    ))}
                    {/* Preço e Produtos */}
                    <td className="px-4 py-3 text-center">
                      <input
                        name="servicos"
                        value={formEdit.servicos?.map(s => s.preco).join(", ")}
                        onChange={atualizarCampo}
                        className="w-full border px-2 py-1 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        name="produtos"
                        value={formEdit.produtos?.map(p => p.preco).join(", ")}
                        onChange={atualizarCampo}
                        className="w-full border px-2 py-1 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">{formEdit.precoTotal}€</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        name="dataEntrada"
                        type="date"
                        value={formEdit.dataEntrada || ""}
                        onChange={atualizarCampo}
                        className="w-full border px-2 py-1 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        name="status"
                        value={formEdit.status || "em fila de espera"}
                        onChange={atualizarCampo}
                        className="w-full border px-2 py-1 rounded"
                      >
                        <option value="em fila de espera">Em fila de espera</option>
                        <option value="em manutenção">Em manutenção</option>
                        <option value="a aguardar peças">A aguardar peças</option>
                        <option value="pronto para entrega">Pronto para entrega</option>
                        <option value="entregue">Entregue</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        name="dataEntrega"
                        type="date"
                        value={formEdit.dataEntrega || ""}
                        onChange={atualizarCampo}
                        className="w-full border px-2 py-1 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ActionButton type="salvar" onClick={salvarEdicao}>💾</ActionButton>
                      <ActionButton type="cancelar" onClick={cancelarEdicao}>✖️</ActionButton>
                    </td>
                  </>
                ) : (
                  <>
                    {/* Modo visualização */}
                    <td className="px-4 py-3 text-center break-words">{s.numeroServico}</td>
                    <td className="px-4 py-3 text-center break-words">{s.cliente}</td>
                    <td className="px-4 py-3 text-center break-words">{s.contacto}</td>
                    <td className="px-4 py-3 text-center break-words">{s.tipoInstrumento}</td>
                    <td className="px-4 py-3 text-center break-words">{s.marca}</td>
                    <td className="px-4 py-3 text-center break-words">{s.modelo}</td>
                    <td className="px-4 py-3 text-center break-words">{s.numeroSerie}</td>
                    <td className="px-4 py-3 text-center break-words">{s.servicoEfetuar}</td>
                    <td className="px-4 py-3 text-center">
                      {Array.isArray(s.servicos) ? s.servicos.map((s) => `${s.preco}€`).join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {Array.isArray(s.produtos) ? s.produtos.map((p) => `${p.preco}€`).join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">{calcularPrecoTotal(s)}</td>
                    <td className="px-4 py-3 text-center">
                      {formatarData(s.dataEntrada)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block min-w-[90px] text-xs font-semibold text-white px-2 py-1 rounded-full ${statusClass}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatarData(s.dataEntrega)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ActionButton
                        type="editar"
                        onClick={() => editarServico(s)}
                      >
                        ✏️
                      </ActionButton>
                      <ActionButton
                        type="apagar"
                        onClick={() => {
                          setServiceToDelete(s.id);
                          setIsDeleteModalOpen(true);
                        }}
                      >
                        🗑️
                      </ActionButton>
                      <ActionButton
                        type="salvar"
                        onClick={() => atualizarStatus(s.id, "pronto para entrega", s.contacto)}
                      >
                        Pronto para entrega
                      </ActionButton>
                      <ActionButton
                        type="salvar"
                        onClick={() => atualizarStatus(s.id, "a aguardar peças", s.contacto)}
                      >
                        A aguardar peças
                      </ActionButton>
                      <ActionButton
                        type="salvar"
                        onClick={() => atualizarStatus(s.id, "em manutenção", s.contacto)}
                      >
                        Em manutenção
                      </ActionButton>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal de Confirmação */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => {
          const mensagem = mensagemWhatsapp ;
          const whatsappUrl = `https://wa.me/${telefoneCliente}?text=${encodeURIComponent(mensagem)}`;
          window.open(whatsappUrl, "_blank");
        }}
        telefoneCliente={telefoneCliente}
      />

      {/* Modal de Confirmação para Apagar */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleteConfirm={() => apagarServico(serviceToDelete)}
        isDeleteModal={true}
      />
    </div>
  );
}
