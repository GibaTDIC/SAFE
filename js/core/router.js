// ======================================================
// SAFE - Sistema de Avaliação Física Escolar
// Arquivo: router.js
// Criado por: Gibabit
// Versão: 1.0
// Criação: 2026
// ======================================================
// ======================================================


import { mostrarToast } from "./utils.js";

const content = document.getElementById("content");

const routes = {

    dashboard:{
    html:"pages/dashboard/dashboard.html",
    js:"../modules/dashboard.js"
   },

    turmas:{
    html:"pages/gestao/turmas.html",
    js:"../modules/turmas.js"
   },

    alunos:{
    html:"pages/gestao/alunos.html",
    js:"../modules/aluno.js"
   },

    escolas:{
    html:"pages/gestao/escolas.html",
    js:"../modules/escolas.js"
   },

    professores:{
    html:"pages/gestao/professores.html",
    js:"../modules/professores.js"
   },

    funcionarios:{
    html:"pages/gestao/funcionarios.html",
    js:"../modules/funcionarios.js"
   },

    antropometriaAdulto:{
    html:"pages/avaliacoes/antropometriaAdulto.html",
    js:"../modules/antropometriaAdulto.js"
   },

    leger:{
    html:"pages/avaliacoes/leger.html",
    js:"../modules/leger.js"
   },

    circunferenciacintura:{
    html:"pages/avaliacoes/circunferenciacintura.html",
    js:"../modules/circunferenciacintura.js"
   },

    imc:{
    html:"pages/avaliacoes/imc.html",
    js:"../modules/imc.js"
   },

    flexibilidade:{
    html:"pages/avaliacoes/flexibilidade.html",
    js:"../modules/flexibilidade.js"
   },

    abdominal:{
    html:"pages/avaliacoes/abdominal.html",
    js:"../modules/abdominal.js"
   },

    medicineball:{
    html:"pages/avaliacoes/medicineball.html",
    js:"../modules/medicineball.js"
   },

    saltohorizontal:{
    html:"pages/avaliacoes/saltohorizontal.html",
    js:"../modules/saltohorizontal.js"
   },

    agilidade:{
    html:"pages/avaliacoes/agilidade.html",
    js:"../modules/agilidade.js"
   },

    corrida20m:{
    html:"pages/avaliacoes/corrida20m.html",
    js:"../modules/corrida20m.js"
   },

    corrida6min:{
    html:"pages/avaliacoes/corrida6min.html",
    js:"../modules/corrida6min.js"
   },

    tgmd3:{
    html:"pages/avaliacoes/tgmd3.html",
    js:"../modules/tgmd3.js"
   },

    relatorios:{
    html:"pages/relatorios/relatorios.html",
    js:"../modules/relatorios.js"
   },

    relatorioIndividual:{
    html:"pages/relatorios/relatorioIndividual.html",
    js:"../modules/relatorioIndividual.js"
   },

    relatorioTurma:{
    html:"pages/relatorios/relatorioTurma.html",
    js:"../modules/relatorioTurma.js"
   },

    relatorioEscola:{
    html:"pages/relatorios/relatorioEscola.html",
    js:"../modules/relatorioEscola.js"
   },

    repararDados:{
    html:"pages/administracao/repararDados.html",
    js:"../modules/repararDados.js"
   },

    relatorioEstatisticas:{
    html:"pages/relatorios/relatorioEstatisticas.html",
    js:"../modules/relatorioEstatisticas.js"
   },

    fichaAvaliacao:{
    html:"pages/relatorios/fichaAvaliacao.html",
    js:"../modules/fichaAvaliacao.js"
   },

    relatorioCientifico:{
    html:"pages/relatorios/relatorioCientifico.html",
    js:"../modules/relatorioCientifico.js"
   },

    configuracoes:{
    html:"pages/administracao/configuracoes.html",
    js:"../modules/configuracoes.js"
   },

    backup:{
    html:"pages/administracao/backup.html",
    js:"../modules/backup.js"
   },

};

// ======================================================

export async function loadPage(page){

    try{

        if(!routes[page]){

            content.innerHTML="<h2>Página não encontrada.</h2>";

            return;

        }

        // HTML

        const resposta=await fetch(routes[page].html);

        content.innerHTML=await resposta.text();

        // Toda vez que abrir uma página nova, começa do topo — sem isso,
        // se o usuário tivesse rolado o menu ou o conteúdo anterior pra
        // baixo, a nova página abria já deslocada.
        window.scrollTo(0, 0);

        content.scrollTop = 0;

        marcarMenu(page);

        // JS

        if(routes[page].js){

            console.log("Carregando módulo:", routes[page].js);

            const modulo=await import(routes[page].js);

            if(modulo.init){

                await modulo.init();

            }

        }

    }

    catch(erro){

        console.error(erro);

        content.innerHTML="<h2>Erro ao abrir o módulo.</h2>";

    }

}

// ======================================================

function marcarMenu(page){

    document

    .querySelectorAll(".sidebar li[data-page]")

    .forEach(item=>{

        item.classList.remove("active");

        if(item.dataset.page===page){

            item.classList.add("active");

            const grupo = item.closest(".menu-group");

            if(grupo){

                grupo.classList.add("open");

            }

        }

    });

}

// ======================================================

export function iniciarMenu(){

    // Menu sanduíche (só aparece em telas pequenas, via CSS)
    const btnHamburguer = document.getElementById("btnMenuHamburguer");

    const sidebar = document.querySelector(".sidebar");

    const overlay = document.getElementById("overlayMenu");

    function abrirMenuMobile(){

        sidebar?.classList.add("aberto");

        overlay?.classList.add("aberto");

    }

    function fecharMenuMobile(){

        sidebar?.classList.remove("aberto");

        overlay?.classList.remove("aberto");

    }

    if(btnHamburguer){

        btnHamburguer.onclick = () => {

            if(sidebar?.classList.contains("aberto")){

                fecharMenuMobile();

            }else{

                abrirMenuMobile();

            }

        };

    }

    if(overlay){

        overlay.onclick = fecharMenuMobile;

    }

    // Grupos expansíveis (Cadastros, Avaliações Físicas, etc.)
    document

    .querySelectorAll(".menu-group-header")

    .forEach(header=>{

        header.onclick=()=>{

            header.closest(".menu-group").classList.toggle("open");

        };

    });

    // Itens de navegação (com rota pronta)
    document

    .querySelectorAll(".sidebar li[data-page]")

    .forEach(item=>{

        item.onclick=()=>{

            loadPage(item.dataset.page);

            fecharMenuMobile();

        };

    });

    // Itens ainda não implementados ("em breve")
    document

    .querySelectorAll(".sidebar li.disabled")

    .forEach(item=>{

        item.onclick=()=>{

            mostrarToast("Esse módulo ainda está em construção.", "erro");

        };

    });

}
