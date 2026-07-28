// ======================================================
// SAFE
// Arquivo: testeInfoUI.js
//
// Componente reutilizável: ícone pequeno ao lado do nome
// do teste, que abre um pop-up com a imagem ilustrativa e
// a descrição do protocolo. Usado tanto nas telas do
// professor quanto no portal do aluno.
// ======================================================

import { TESTES_INFO } from "./testesInfo.js";

// Devolve o HTML do ícone clicável (ou string vazia se esse
// teste ainda não tiver imagem cadastrada). Não usa <img
// onerror> pra esconder sozinho porque cada tela pode
// querer decidir o que fazer quando falta imagem — aqui,
// simplesmente já nem gera o ícone se não tiver imagem.
export function iconeTeste(chave, tamanhoPx = 32){

    const info = TESTES_INFO[chave];

    if(!info){
        return "";
    }

    return `

        <img
            src="${info.imagem}"
            alt="${info.titulo}"
            class="icone-teste"
            style="width:${tamanhoPx}px; height:${tamanhoPx}px;"
            onerror="this.style.display='none'"
            onclick="window.abrirInfoTeste && window.abrirInfoTeste('${chave}')">

    `;

}

// Monta o pop-up (uma vez só por página) e a função global
// que abre ele com o conteúdo do teste escolhido.
export function iniciarPopupTestes(){

    if(document.getElementById("modalInfoTeste")){
        return;
    }

    const modal = document.createElement("div");

    modal.id = "modalInfoTeste";

    modal.className = "modal-info-teste";

    modal.innerHTML = `

        <div class="modal-info-teste-conteudo">

            <button class="fechar-info-teste" type="button">&times;</button>

            <img id="imgInfoTeste" src="" alt="">

            <h3 id="tituloInfoTeste"></h3>

            <p id="descricaoInfoTeste"></p>

        </div>

    `;

    document.body.appendChild(modal);

    modal.querySelector(".fechar-info-teste").addEventListener("click", () => {

        modal.classList.remove("show");

    });

    modal.addEventListener("click", (evento) => {

        if(evento.target === modal){

            modal.classList.remove("show");

        }

    });

    window.abrirInfoTeste = function(chave){

        const info = TESTES_INFO[chave];

        if(!info){
            return;
        }

        const img = document.getElementById("imgInfoTeste");

        img.src = info.imagem;

        img.style.display = "block";

        img.onerror = () => { img.style.display = "none"; };

        document.getElementById("tituloInfoTeste").textContent = info.titulo;

        document.getElementById("descricaoInfoTeste").textContent = info.descricao;

        modal.classList.add("show");

    };

}

// ======================================================
// MODAL "COMO EXECUTAR ESTE TESTE" — versão completa,
// usada pelo botão de destaque no topo de cada tela de
// avaliação (bem mais rico que o ícone de ajuda acima).
// ======================================================

function listaHtml(itens){

    return `<ul class="lista-como-executar">${itens.map(i => `<li>${i}</li>`).join("")}</ul>`;

}

export function iniciarModalComoExecutar(){

    if(document.getElementById("modalComoExecutar")){
        return;
    }

    const modal = document.createElement("div");

    modal.id = "modalComoExecutar";

    modal.className = "modal";

    modal.innerHTML = `

        <div class="modal-content modal-como-executar-conteudo">

            <button class="fechar-como-executar" type="button" style="float:right; background:none; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>

            <h2 id="tituloComoExecutar"></h2>

            <img id="imgComoExecutar" src="" alt="" style="max-width:100%; border-radius:12px; margin:14px 0;">

            <p id="videoComoExecutar" style="color:#94a3b8; font-size:13px;"></p>

            <p id="descricaoComoExecutar" style="margin-bottom:16px;"></p>

            <h4>📦 Materiais necessários</h4>
            <div id="materiaisComoExecutar"></div>

            <h4>✅ Como executar</h4>
            <div id="execucaoComoExecutar"></div>

            <h4>☑️ Critérios de validação</h4>
            <div id="validacaoComoExecutar"></div>

            <h4>⚠️ Erros mais comuns</h4>
            <div id="errosComoExecutar"></div>

            <h4>📝 Forma de registrar</h4>
            <p id="registrarComoExecutar"></p>

        </div>

    `;

    document.body.appendChild(modal);

    modal.querySelector(".fechar-como-executar").addEventListener("click", () => {

        modal.classList.remove("show");

    });

    modal.addEventListener("click", (evento) => {

        if(evento.target === modal){

            modal.classList.remove("show");

        }

    });

    window.abrirComoExecutar = function(chave){

        const info = TESTES_INFO[chave];

        if(!info){
            return;
        }

        document.getElementById("tituloComoExecutar").textContent = `${info.titulo}`;

        const img = document.getElementById("imgComoExecutar");

        img.src = info.imagem;

        img.style.display = "block";

        img.onerror = () => { img.style.display = "none"; };

        document.getElementById("videoComoExecutar").textContent = info.video

            ? ""

            : "🎥 Vídeo demonstrativo: ainda não disponível nessa versão.";

        document.getElementById("descricaoComoExecutar").textContent = info.descricao;

        document.getElementById("materiaisComoExecutar").innerHTML = listaHtml(info.materiais || []);

        document.getElementById("execucaoComoExecutar").innerHTML = listaHtml(info.criteriosExecucao || []);

        document.getElementById("validacaoComoExecutar").innerHTML = listaHtml(info.criteriosValidacao || []);

        document.getElementById("errosComoExecutar").innerHTML = listaHtml(info.errosComuns || []);

        document.getElementById("registrarComoExecutar").textContent = info.formaRegistrar || "-";

        modal.classList.add("show");

    };

}