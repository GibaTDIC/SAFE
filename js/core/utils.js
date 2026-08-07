// ======================================================
// SAFE
// Biblioteca de Utilidades
// ======================================================

//-------------------------------------------------------
// CONTEXTO DO USUÁRIO LOGADO
// (gravado no sessionStorage pelo auth.js/app.js no login)
//-------------------------------------------------------

export function obterContextoUsuario(){

    return {

        uid: sessionStorage.getItem("safe_uid") || "",

        papel: sessionStorage.getItem("safe_papel") || "",

        escolaId: sessionStorage.getItem("safe_escolaId") || "",

        nome: sessionStorage.getItem("safe_nome") || ""

    };

}

export function souSuperAdmin(){

    return obterContextoUsuario().papel === "super_admin";

}

// Professor/admin_escola marcado como "somente leitura" (restrição
// aplicada por um admin_escola) — continua logando e vendo tudo, só
// não consegue criar/editar/excluir nada. A trava de verdade está nas
// regras do Firestore; isso aqui é só pra UI (avisos, esconder botão).
export function souSomenteLeitura(){

    return sessionStorage.getItem("safe_somenteLeitura") === "1";

}

// Todas as escolas que o usuário atende (professor pode ter mais de uma;
// admin_escola/super_admin normalmente têm só a própria, ou nenhuma)
export function obterEscolasVinculadas(){

    try{

        return JSON.parse(sessionStorage.getItem("safe_escolaIds") || "[]");

    }catch(e){

        return [];

    }

}

// Troca a "escola ativa" da sessão (o que obterEscolaId() devolve).
// Não precisa re-logar — só atualiza o valor guardado.
export function definirEscolaAtiva(escolaId){

    sessionStorage.setItem("safe_escolaId", escolaId);

}

// Retorna o escolaId do usuário logado, ou "" se for super_admin
// (super_admin não tem escola própria — vê tudo sem filtro)
export function obterEscolaId(){

    return obterContextoUsuario().escolaId;

}

//-------------------------------------------------------
// TOAST
//-------------------------------------------------------

export function mostrarToast(
    mensagem,
    tipo = "sucesso"
){

    let toast = document.getElementById("safe-toast");

    if(!toast){

        toast = document.createElement("div");

        toast.id = "safe-toast";

        document.body.appendChild(toast);

    }

    toast.className = tipo;

    toast.innerHTML = mensagem;

    toast.style.display = "block";

    setTimeout(()=>{

        toast.style.display="none";

    },3000);

}

//-------------------------------------------------------
// CONFIRMAÇÃO
//-------------------------------------------------------

export function confirmar(mensagem){

    return confirm(mensagem);

}

//-------------------------------------------------------
// LIMPAR FORMULÁRIO
//-------------------------------------------------------

export function limparFormulario(formulario){

    formulario.reset();

}

//-------------------------------------------------------
// DATA
//-------------------------------------------------------

export function dataAtual(){

    return new Date().toLocaleDateString("pt-BR");

}

// Idade a partir de uma data de nascimento em ISO (aaaa-mm-dd).
// Usada por praticamente todos os módulos de avaliação (cálculo de
// idade do aluno/funcionário na hora do teste).
export function calcularIdade(dataNascimentoISO){

    if(!dataNascimentoISO){

        return "-";

    }

    const nascimento = new Date(dataNascimentoISO);

    if(isNaN(nascimento)){

        return "-";

    }

    const hoje = new Date();

    let idade = hoje.getFullYear() - nascimento.getFullYear();

    const aindaNaoFezAniversario =
        hoje.getMonth() < nascimento.getMonth() ||
        (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());

    if(aindaNaoFezAniversario){

        idade--;

    }

    return idade;

}