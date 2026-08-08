// ======================================================
// SAFE - Sistema de Avaliação Física Escolar
// Arquivo: app.js
// Módulo: Inicialização
// ======================================================

import { iniciarMenu, loadPage } from "./router.js";
import { auth, db } from "./firebase.js";
import { souSuperAdmin } from "./utils.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  documentId
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Só inicializa o painel depois de confirmar que existe um usuário logado.
// Sem isso, quem souber a URL de admin.html entra direto, sem passar pelo login.
onAuthStateChanged(auth, async (usuario) => {

    if(!usuario){

        location.href = "login.html";

        return;

    }

    // Se abriu numa aba nova (ex: colou a URL, ou já estava logado de antes),
    // o Firebase Auth reconhece a sessão, mas o sessionStorage dessa aba
    // pode estar vazio OU pertencer a outro usuário (ex: trocou de conta sem
    // clicar em "Sair" antes). Nos dois casos, recarrega o contexto certo
    // do Firestore antes de continuar — senão os módulos filtram os dados
    // com a escola/papel de quem estava logado ANTES, não do usuário atual.
    if(sessionStorage.getItem("safe_uid") !== usuario.uid){

        try{

            const snap = await getDoc(doc(db,"usuarios",usuario.uid));

            if(snap.exists()){

                const dados = snap.data();

                // Compatibilidade: contas antigas só têm "escolaId" (um valor).
                // Tratamos como lista de 1 item se "escolaIds" não existir.
                const escolaIds = Array.isArray(dados.escolaIds)
                    ? dados.escolaIds
                    : (dados.escolaId ? [dados.escolaId] : []);

                sessionStorage.setItem("safe_uid", usuario.uid);
                sessionStorage.setItem("safe_papel", dados.papel || "professor");
                sessionStorage.setItem("safe_escolaIds", JSON.stringify(escolaIds));
                sessionStorage.setItem("safe_escolaId", escolaIds[0] || "");
                sessionStorage.setItem("safe_somenteLeitura", dados.somenteLeitura === true ? "1" : "0");
                sessionStorage.setItem("safe_nome", dados.nome || "");

            }else{

                // Documento não existe (conta órfã/excluída) — não deixa
                // seguir com dados de outro usuário por engano.
                sessionStorage.clear();

                await signOut(auth);

                location.href = "login.html";

                return;

            }

        }catch(erro){

            console.error("Erro ao recarregar contexto do usuário:", erro);

        }

    }

    exibirUsuarioLogado();

    exibirBannerSomenteLeitura();

    aplicarVisibilidadePorPapel();

    await montarSeletorDeEscola();

    iniciarMenu();

    loadPage("dashboard");

    const btnSair = document.getElementById("logout");

    if(btnSair){

        btnSair.addEventListener("click", async () => {

            await signOut(auth);

            sessionStorage.clear();

            location.href = "login.html";

        });

    }

});

// ======================================================
// MOSTRA NOME + PAPEL DE QUEM ESTÁ LOGADO NO TOPO DA TELA
// ======================================================

function exibirBannerSomenteLeitura(){

    const banner = document.getElementById("bannerSomenteLeitura");

    if(!banner){

        return;

    }

    const emSomenteLeitura = sessionStorage.getItem("safe_somenteLeitura") === "1";

    banner.style.display = emSomenteLeitura ? "block" : "none";

    // Em modo leitura, o professor só enxerga o grupo de Relatórios no
    // menu — os outros somem (Cadastros, Avaliações Físicas,
    // Administração). Isso é só conveniência de navegação; a trava de
    // verdade continua nas regras do Firestore, não aqui.
    if(emSomenteLeitura){

        document.querySelectorAll(".menu-group").forEach(grupo=>{

            if(grupo.dataset.grupo !== "relatorios"){

                grupo.style.display = "none";

            }

        });

    }

}

// ======================================================
// ESCONDE ITENS DE MENU CONFORME O PAPEL
// Coordenador (admin_escola) não aplica avaliação — some os
// grupos "Avaliações Físicas" e "Avaliação de Adultos" inteiros.
// Avaliador (professor) não gerencia outros avaliadores nem
// escolas — some só esses dois itens, dentro de "Cadastros".
// Isso é só conveniência de navegação, igual ao banner de
// somente leitura acima — a trava de verdade está nas regras
// do Firestore (podeAplicarAvaliacao / escolas / usuarios).
// ======================================================

function aplicarVisibilidadePorPapel(){

    const papel = sessionStorage.getItem("safe_papel");

    if(papel === "admin_escola"){

        ["avaliacoes", "adultos"].forEach(grupo=>{

            const elemento = document.querySelector(`.menu-group[data-grupo="${grupo}"]`);

            if(elemento){

                elemento.style.display = "none";

            }

        });

    }else if(papel === "professor"){

        ["professores", "escolas"].forEach(pagina=>{

            const item = document.querySelector(`.sidebar li[data-page="${pagina}"]`);

            if(item){

                item.style.display = "none";

            }

        });

    }

}

function exibirUsuarioLogado(){

    const elemento = document.getElementById("usuarioLogado");

    if(!elemento){

        return;

    }

    const nome = sessionStorage.getItem("safe_nome") || "Usuário";

    const papel = sessionStorage.getItem("safe_papel") || "professor";

    const rotulosPapel = {

        super_admin: "Super Admin",
        admin_escola: "Coordenador",
        professor: "Avaliador"

    };

    elemento.textContent = `${nome} (${rotulosPapel[papel] || papel})`;

}

// ======================================================
// SELETOR DE ESCOLA ATIVA
// Só aparece se o usuário estiver vinculado a mais de uma
// escola (ex: professor que dá aula em 2 escolas). Trocar
// a escola ativa recarrega a página inteira — mais simples
// e seguro do que tentar atualizar todos os módulos na mão.
// ======================================================

async function montarSeletorDeEscola(){

    const container = document.getElementById("seletorEscolaContainer");

    if(!container){

        return;

    }

    let escolaIds = [];

    try{

        escolaIds = JSON.parse(sessionStorage.getItem("safe_escolaIds") || "[]");

    }catch(e){

        escolaIds = [];

    }

    if(escolaIds.length === 0){

        // super_admin sem escola própria — não filtra nada, mas mostra
        // um indicador deixando claro que está vendo tudo junto.
        if(souSuperAdmin()){

            container.innerHTML = `

                <div class="escola-atual-badge" title="Você vê dados de todas as escolas ao mesmo tempo">
                    <i class="bi bi-globe2"></i>
                    Modo: Todas as Escolas
                </div>

            `;

        }else{

            container.innerHTML = "";

        }

        return;

    }

    try{

        // Busca os nomes das escolas (o "in" do Firestore aceita até 30 ids)
        const q = query(collection(db,"escolas"), where(documentId(), "in", escolaIds.slice(0,30)));

        const snapshot = await getDocs(q);

        const nomesPorId = {};

        snapshot.forEach(d => nomesPorId[d.id] = d.data().nome || d.id);

        const escolaAtiva = sessionStorage.getItem("safe_escolaId") || escolaIds[0];

        if(escolaIds.length === 1){

            // só uma escola — mostra como rótulo fixo (nada pra trocar)
            container.innerHTML = `

                <div class="escola-atual-badge" title="Escola atual">
                    <i class="bi bi-building"></i>
                    ${nomesPorId[escolaAtiva] || "Escola"}
                </div>

            `;

            return;

        }

        // mais de uma escola — mostra o seletor de troca
        const opcoes = escolaIds

            .map(id => `<option value="${id}" ${id === escolaAtiva ? "selected" : ""}>${nomesPorId[id] || id}</option>`)

            .join("");

        container.innerHTML = `

            <div class="escola-atual-badge escola-atual-com-select" title="Escola atual — clique pra trocar">
                <i class="bi bi-building"></i>
                <select id="seletorEscolaAtiva" title="Trocar escola ativa">
                    ${opcoes}
                </select>
            </div>

        `;

        document.getElementById("seletorEscolaAtiva").addEventListener("change", (evento)=>{

            sessionStorage.setItem("safe_escolaId", evento.target.value);

            // Recarrega tudo — mais simples e seguro do que atualizar
            // cada módulo aberto na mão pra refletir a escola nova.
            location.reload();

        });

    }catch(erro){

        console.error("Erro ao montar seletor de escola:", erro);

    }

}