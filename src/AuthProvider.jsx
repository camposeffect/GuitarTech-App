import { useState, useEffect, createContext, useContext } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

// Criação de contexto
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Estado de autenticação:", user); // Verifique se o usuário é autenticado corretamente
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};
