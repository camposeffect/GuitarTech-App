import { useState } from "react";
import FormularioRececao from "./FormularioRececao";
import FormularioEntrega from "./FormularioEntrega";

export default function App() {
  const [pagina, setPagina] = useState("rececao"); // "rececao" ou "entrega"

  return (
    <div>
      <nav style={{ padding: 20, textAlign: "center", backgroundColor: "#333" }}>
        <button
          onClick={() => setPagina("rececao")}
          style={{ marginRight: 10, padding: "10px 20px", cursor: "pointer" }}
        >
          Receção
        </button>
        <button
          onClick={() => setPagina("entrega")}
          style={{ padding: "10px 20px", cursor: "pointer" }}
        >
          Entrega
        </button>
      </nav>

      {pagina === "rececao" ? <FormularioRececao /> : <FormularioEntrega />}
    </div>
  );
}
