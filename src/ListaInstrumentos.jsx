import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export default function ListaInstrumentos({ userId, clienteId, onSelecionarInstrumento }) {
  const [instrumentos, setInstrumentos] = useState([]);
  const [instrumentoIdSelecionado, setInstrumentoIdSelecionado] = useState("");

  useEffect(() => {
    if (!userId || !clienteId) {
      setInstrumentos([]);
      setInstrumentoIdSelecionado("");
      onSelecionarInstrumento(null);
      return;
    }

    const instrumentosRef = collection(db, "empresas", userId, "clientes", clienteId, "instrumentos");
    const unsubscribe = onSnapshot(instrumentosRef, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setInstrumentos(lista);
    });

    return () => unsubscribe();
  }, [userId, clienteId, onSelecionarInstrumento]);

  const handleChange = (e) => {
    const instr = instrumentos.find((i) => i.id === e.target.value) || null;
    setInstrumentoIdSelecionado(e.target.value);
    onSelecionarInstrumento(instr);
  };

  return (
    <div className="mb-4">
      <label className="block font-semibold mb-1">Instrumento</label>
      <select
        className="w-full p-2 border border-gray-300 rounded"
        value={instrumentoIdSelecionado}
        onChange={handleChange}
        disabled={!clienteId}
      >
        <option value="">Selecionar instrumento</option>
        {instrumentos.map((i) => (
          <option key={i.id} value={i.id}>
            {i.tipoInstrumento} — {i.marca} {i.modelo}
          </option>
        ))}
      </select>
    </div>
  );
}
