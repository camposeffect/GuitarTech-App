import { useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "./AuthProvider";

export default function useCompanyData() {
  const { user } = useAuth();
  const [company, setCompany] = useState(undefined); // ⬅️ undefined inicial para controlar loading

  useEffect(() => {
    if (!user) return;

    const fetchCompany = async () => {
      try {
        const docRef = doc(db, "empresas", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompany({
            nomeEmpresa: data.nomeEmpresa || "",
            morada: data.morada || "",
            codigoPostal: data.codigoPostal || "",
            localidade: data.localidade || "",
            contacto: data.contacto || "",
            email: data.email || "", // ⬅️ novo campo
            nif: data.nif || "",
            logoBase64: data.logoBase64 || "",
            userUid: user.uid
          });
        } else {
          setCompany(null);
        }
      } catch (error) {
        console.error("Erro ao carregar dados da empresa:", error);
        setCompany(null);
      }
    };

    fetchCompany();
  }, [user]); // Recarregar sempre que o 'user' mudar

  return company;
}
