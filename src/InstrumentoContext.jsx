import React, { createContext, useContext, useState } from "react";

const InstrumentoContext = createContext();

export function InstrumentoProvider({ children }) {
  const [instrumentos, setInstrumentos] = useState([]);
  return (
    <InstrumentoContext.Provider value={{ instrumentos, setInstrumentos }}>
      {children}
    </InstrumentoContext.Provider>
  );
}

export function useInstrumentos() {
  return useContext(InstrumentoContext);
}
