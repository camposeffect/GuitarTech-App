import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "./AuthProvider";

// Hook de Debounce para otimizar a pesquisa
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

export default function GestaoClientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pesquisaGeral, setPesquisaGeral] = useState("");
  const [modalConfirmacao, setModalConfirmacao] = useState(null); // Controla o modal de confirmação
  const [modalExcluirCliente, setModalExcluirCliente] = useState(null); // Modal para excluir cliente
  const [modalExcluirInstrumento, setModalExcluirInstrumento] = useState(null); // Modal para excluir instrumento
  const [modalTransferirInstrumento, setModalTransferirInstrumento] = useState(null); // Modal para transferir instrumento
  const [modalExcluirServico, setModalExcluirServico] = useState(null); // Modal para excluir serviço anterior
  const [clienteSelecionado, setClienteSelecionado] = useState(null); // Estado para armazenar o cliente selecionado para a transferência
  const pesquisaDebounced = useDebounce(pesquisaGeral, 500); // Debounce com 500ms

  useEffect(() => {
    const q = query(collection(db, "empresas", user.uid, "clientes"));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const clientesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const clientesComInstrumentos = await Promise.all(
        clientesData.map(async (c) => {
          const instSnap = await getDocs(
            collection(db, "empresas", user.uid, "clientes", c.id, "instrumentos")
          );
          const instrumentos = instSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { ...c, instrumentos };
        })
      );
      setClientes(clientesComInstrumentos);
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  // Função de pesquisa
  const filtrarClientes = (clientes) => {
    const filtro = pesquisaDebounced.toLowerCase();
    return clientes.filter((c) => {
      const bateCliente =
        c.nome?.toLowerCase().includes(filtro) || c.contacto?.toLowerCase().includes(filtro);
      const bateInstrumento = c.instrumentos?.some((inst) =>
        [inst.tipoInstrumento, inst.marca, inst.modelo, inst.numeroSerie].some((campo) =>
          campo?.toLowerCase().includes(filtro)
        )
      );
      return bateCliente || bateInstrumento;
    });
  };

  const apagarServicoAnterior = async (clienteId, instrumentoId, index) => {
    const instrumentoRef = doc(db, "empresas", user.uid, "clientes", clienteId, "instrumentos", instrumentoId);
    const instSnap = await getDocs(collection(db, "empresas", user.uid, "clientes", clienteId, "instrumentos"));
    const instDoc = instSnap.docs.find((d) => d.id === instrumentoId);
    if (!instDoc) return;

    const instData = instDoc.data();
    const servicos = instData.servicosAnteriores || [];
    servicos.splice(index, 1);

    await updateDoc(instrumentoRef, { servicosAnteriores: servicos });
    setSelecionado(null);
    setModalExcluirServico(null); // Fechar o modal após a confirmação
  };

  const excluirCliente = async (clienteId) => {
    try {
      await deleteDoc(doc(db, "empresas", user.uid, "clientes", clienteId));
      setModalExcluirCliente(null); // Fechar o modal após a exclusão
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
    }
  };

  const excluirInstrumento = async (clienteId, instrumentoId) => {
    try {
      await deleteDoc(doc(db, "empresas", user.uid, "clientes", clienteId, "instrumentos", instrumentoId));
      setModalExcluirInstrumento(null); // Fechar o modal após a exclusão
    } catch (error) {
      console.error("Erro ao excluir instrumento:", error);
    }
  };

  const transferirInstrumento = async (clienteOrigemId, instrumentoId, clienteDestinoId) => {
    try {
      const instrumentoRef = doc(db, "empresas", user.uid, "clientes", clienteOrigemId, "instrumentos", instrumentoId);
      const instrumentoSnap = await getDocs(collection(db, "empresas", user.uid, "clientes", clienteOrigemId, "instrumentos"));
      const instrumentoDoc = instrumentoSnap.docs.find((d) => d.id === instrumentoId);
      if (!instrumentoDoc) return;

      const instrumentoData = instrumentoDoc.data();

      // Adicionar o instrumento ao cliente de destino
      await setDoc(
        doc(db, "empresas", user.uid, "clientes", clienteDestinoId, "instrumentos", instrumentoId),
        instrumentoData
      );

      // Apagar o instrumento do cliente original
      await deleteDoc(instrumentoRef);

      setModalTransferirInstrumento(null); // Fechar o modal após a transferência
      alert("Instrumento transferido com sucesso!");
    } catch (error) {
      console.error("Erro ao transferir instrumento:", error);
    }
  };

  const formatLabel = (key) => {
    const map = {
      upgrades: "Upgrades",
      outros: "Outros",
      cordasAplicadas: "Cordas aplicadas",
      afinacao: "Afinação",
      acao12LowE: "Ação 12º Fret Low E",
      acao12HighE: "Ação 12º Fret High E",
      acao1Fret: "Ação 1º Fret",
      alturaPickups: "Altura dos pickups",
    };
    return map[key] || key;
  };

  // Função para formatar a data de string para Date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString); // Converte a string para um objeto Date
    return date.toLocaleDateString(); // Retorna no formato local
  };

  if (loading) return <p>A carregar clientes...</p>;

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Gestão de Clientes</h2>

      <div className="flex gap-6 flex-wrap">
        {/* Lista de clientes */}
        <div className="w-full sm:w-1/3 flex flex-col">
          <input
            type="search"
            placeholder="Pesquisar cliente ou instrumento..."
            value={pesquisaGeral}
            onChange={(e) => {
              setPesquisaGeral(e.target.value);
              setSelecionado(null);
            }}
            className="mb-3 p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-blue-500 transition-all duration-300"
          />

          <ul className="bg-white border rounded-lg shadow-lg max-h-[600px] overflow-auto">
            {filtrarClientes(clientes).map((c) => (
              <li
                key={c.id}
                className={`p-3 border-b cursor-pointer hover:bg-gray-100 transition-all duration-300 ${
                  selecionado?.id === c.id ? "bg-gray-200 font-semibold" : ""
                }`}
                onClick={() => setSelecionado(c)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-sm text-gray-500">{c.contacto}</span>
                </div>
              </li>
            ))}
            {filtrarClientes(clientes).length === 0 && (
              <li className="p-3 text-gray-500 italic">Nenhum resultado encontrado</li>
            )}
          </ul>
        </div>

        {/* Dados do cliente selecionado */}
        {selecionado && (
          <div className="w-full sm:w-2/3 bg-white border rounded-lg shadow-lg p-6 space-y-6 overflow-auto max-h-[600px]">
            <h3 className="text-xl font-semibold">Cliente: {selecionado.nome}</h3>

            {selecionado.instrumentos.map((inst) => (
              <div key={inst.id} className="border rounded-lg p-4 mb-4 bg-gray-50 shadow-md">
                <h4 className="text-md font-semibold mb-2">
                  {inst.tipoInstrumento} {inst.marca} {inst.modelo}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Nº de Série: {inst.numeroSerie || "—"}
                </p>

                {Array.isArray(inst.servicosAnteriores) &&
                inst.servicosAnteriores.length > 0 ? (
                  <ul className="space-y-3 text-sm bg-white p-3 rounded-lg border">
                    <h5 className="font-semibold text-gray-700 mb-2">Serviços Anteriores</h5>
                    {inst.servicosAnteriores.map((s, idx) => (
                      <li key={idx} className="border-b pb-2 mb-2">
                        <div className="flex justify-between items-center">
                          <span>
                            <strong>{s.servicoEfetuado || "Serviço"}</strong> –{" "}
                            {formatDate(s.dataEntrega) || "Data não disponível"}
                            {s.status ? ` (${s.status})` : ""}
                          </span>
                          <button
                            onClick={() => setModalExcluirServico({ clienteId: selecionado.id, instrumentoId: inst.id, index: idx })}
                            className="text-red-600 hover:text-red-800 text-xs transition-all duration-300"
                          >
                            Apagar
                          </button>
                        </div>

                        {[
                          "upgrades",
                          "outros",
                          "cordasAplicadas",
                          "afinacao",
                          "acao12LowE",
                          "acao12HighE",
                          "acao1Fret",
                          "alturaPickups",
                        ]
                          .filter((k) => s[k])
                          .map((k) => (
                            <p key={k} className="ml-2 text-gray-700">
                              <strong>{formatLabel(k)}:</strong> {s[k]}
                            </p>
                          ))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Nenhum serviço anterior registado.</p>
                )}
                {/* Botões de excluir instrumento e cliente */}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setModalExcluirInstrumento({ clienteId: selecionado.id, instrumentoId: inst.id })}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Excluir Instrumento
                  </button>
                  <button
                    onClick={() => setModalTransferirInstrumento({ clienteId: selecionado.id, instrumentoId: inst.id })}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Transferir Instrumento
                  </button>
                </div>
              </div>
            ))}

            {/* Botão para excluir cliente */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setModalExcluirCliente({ clienteId: selecionado.id })}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Excluir Cliente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Transferir Instrumento */}
      {modalTransferirInstrumento && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold">Transferir Instrumento</h3>
            <p className="text-gray-700 mt-4">
              Selecione o cliente para o qual deseja transferir este instrumento.
            </p>
            <input
              type="search"
              placeholder="Pesquisar cliente..."
              value={pesquisaGeral}
              onChange={(e) => setPesquisaGeral(e.target.value)}
              className="mb-3 p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-blue-500 transition-all duration-300"
            />
            <ul className="bg-white border rounded-lg shadow-lg max-h-[300px] overflow-auto">
              {filtrarClientes(clientes).map((c) => (
                <li
                  key={c.id}
                  className={`p-3 cursor-pointer hover:bg-gray-100 transition-all duration-300 ${
                    clienteSelecionado?.id === c.id ? "bg-blue-100" : "" // Adiciona a classe bg-blue-100 para destacar o cliente selecionado
                  }`}
                  onClick={() => setClienteSelecionado(c)} // Armazena o cliente selecionado
                >
                  {c.nome} ({c.contacto})
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setModalTransferirInstrumento(null)} // Fecha o modal sem fazer nada
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (clienteSelecionado) {
                    transferirInstrumento(modalTransferirInstrumento.clienteId, modalTransferirInstrumento.instrumentoId, clienteSelecionado.id); // Só realiza a transferência se o cliente for selecionado
                    setModalTransferirInstrumento(null); // Fecha o modal após a transferência
                  } else {
                    alert("Selecione um cliente para transferir o instrumento."); // Alerta se não tiver um cliente selecionado
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para confirmação de exclusão do cliente */}
      {modalExcluirCliente && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold">Confirmar Exclusão</h3>
            <p className="text-gray-700 mt-4">
              Tem certeza de que deseja excluir este cliente? Esta ação não pode ser revertida.
            </p>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setModalExcluirCliente(null)} // Fecha o modal sem fazer nada
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => excluirCliente(modalExcluirCliente.clienteId)} // Exclui o cliente
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para confirmação de exclusão do instrumento */}
      {modalExcluirInstrumento && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold">Confirmar Exclusão</h3>
            <p className="text-gray-700 mt-4">
              Tem certeza de que deseja excluir este instrumento? Esta ação não pode ser revertida.
            </p>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setModalExcluirInstrumento(null)} // Fecha o modal sem fazer nada
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => excluirInstrumento(modalExcluirInstrumento.clienteId, modalExcluirInstrumento.instrumentoId)} // Exclui o instrumento
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para confirmação de exclusão do serviço anterior */}
      {modalExcluirServico && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold">Confirmar Exclusão</h3>
            <p className="text-gray-700 mt-4">
              Tem certeza de que deseja excluir este serviço anterior? Esta ação não pode ser revertida.
            </p>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setModalExcluirServico(null)} // Fecha o modal sem fazer nada
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => apagarServicoAnterior(modalExcluirServico.clienteId, modalExcluirServico.instrumentoId, modalExcluirServico.index)} // Exclui o serviço anterior
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
