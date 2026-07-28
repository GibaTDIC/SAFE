import { auth, db } from "./firebase.js";

import {
 signInWithEmailAndPassword,
 signOut
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
 doc,
 getDoc
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const btnLogin =
document.getElementById("btnLogin");

// Se a Home GIBABIT mandou o e-mail na URL (depois de logar lá),
// já preenche esse campo aqui — só poupa uma digitação, não é
// autenticação nenhuma, a senha continua sendo pedida normalmente.
const emailDaUrl = new URLSearchParams(location.search).get("email");

if(emailDaUrl){

    const campoEmail = document.getElementById("email");

    campoEmail.value = emailDaUrl;

    document.getElementById("senha").focus();

}

btnLogin.addEventListener("click", async () => {

 const email =
 document.getElementById("email").value;

 const senha =
 document.getElementById("senha").value;

 try {

   const credencial =
   await signInWithEmailAndPassword(
      auth,
      email,
      senha
   );

   const uid =
   credencial.user.uid;

   const usuarioRef =
   doc(db,"usuarios",uid);

   const usuario =
   await getDoc(usuarioRef);

   if(!usuario.exists()){

       await signOut(auth);

       alert("Usuário não encontrado. Fale com o administrador.");

       return;

   }

   const dadosUsuario = usuario.data();

   if(dadosUsuario.ativo === false){

       await signOut(auth);

       alert("Usuário desativado. Fale com o administrador.");

       return;

   }

   // Guarda dados básicos pra montar a UI (menus, filtros por escola etc.)
   // Isso NÃO é a barreira de segurança — quem garante o acesso de verdade
   // são as regras do Firestore. Isso é só conveniência de interface.
   //
   // Compatibilidade: usuários antigos ainda têm "escolaId" (um valor só).
   // Se não existir "escolaIds" (lista), tratamos o valor antigo como uma
   // lista de 1 item, sem precisar migrar nada manualmente no banco.
   const escolaIds = Array.isArray(dadosUsuario.escolaIds)
       ? dadosUsuario.escolaIds
       : (dadosUsuario.escolaId ? [dadosUsuario.escolaId] : []);

   sessionStorage.setItem("safe_uid", uid);
   sessionStorage.setItem("safe_papel", dadosUsuario.papel || "professor");
   sessionStorage.setItem("safe_escolaIds", JSON.stringify(escolaIds));
   sessionStorage.setItem("safe_escolaId", escolaIds[0] || "");
   sessionStorage.setItem("safe_somenteLeitura", dadosUsuario.somenteLeitura === true ? "1" : "0");
   sessionStorage.setItem("safe_nome", dadosUsuario.nome || "");

   location.href = "admin.html";

 } catch(error){

   alert(traduzErroFirebase(error.code));

 }

});

function traduzErroFirebase(codigo){

    const mensagens = {

        "auth/invalid-email": "E-mail inválido.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/user-not-found": "E-mail ou senha incorretos.",
        "auth/wrong-password": "E-mail ou senha incorretos.",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
        "auth/user-disabled": "Usuário desativado. Fale com o administrador."

    };

    return mensagens[codigo] || "Erro ao entrar. Tente novamente.";

}