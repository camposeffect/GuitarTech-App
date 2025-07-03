import { useState, useEffect } from "react";
import { db } from "./firebase"; // Ajusta o caminho conforme teu projeto
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "./AuthProvider"; // Importa o hook do teu auth

export default function useServicos() {
  const { user } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setServicos([]);
      setLoading(false);
      return;
    }

    const servicosRef = collection(db, "empresas", user.uid, "servicos");
    const q = query(servicosRef, orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const lista = [];
        querySnapshot.forEach((doc) => {
          lista.push({ id: doc.id, ...doc.data() });
        });
        setServicos(lista);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar serviços:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { servicos, loading };
}
