// ======================================================
// SAFE
// Módulo: Antropometria Adulta (IMC, RCE e % de Gordura)
//
// Aplicado só aos funcionários adultos da escola (ver
// js/modules/funcionarios.js) — não faz parte da bateria
// PROESP-Br, que é só pra alunos (6-17 anos). Reúne numa
// única tela as 3 medidas que normalmente são coletadas
// juntas: peso/estatura (IMC), cintura (RCE) e 4 dobras
// cutâneas (% de gordura).
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    obterContextoUsuario,
    mostrarToast,
    calcularIdade
} from "../core/utils.js";

import { iconeTeste, iniciarPopupTestes, iniciarModalComoExecutar } from "../core/testeInfoUI.js";

import { calcularRCE, classificarSaude as classificarRCEAdulto } from "./circunferenciacintura.js";

import{
    collection,
    addDoc,
    getDocs,
    query,
    where,
    Timestamp
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ======================================================
// IMC — classificação OMS pra adultos (diferente da tabela
// por idade/sexo do PROESP-Br, que é só pra crianças —
// ver js/modules/imc.js). Fonte: OMS, faixas de IMC padrão
// pra adultos (18+), amplamente publicadas e estáveis.
// ======================================================

export function calcularIMCAdulto(pesoKg, estaturaCm){

    const estaturaM = estaturaCm / 100;

    return pesoKg / (estaturaM * estaturaM);

}

export function classificarIMCOMS(imc){

    if(imc < 18.5){

        return "Baixo peso";

    }

    if(imc < 25){

        return "Eutrófico";

    }

    if(imc < 30){

        return "Sobrepeso";

    }

    if(imc < 35){

        return "Obesidade I";

    }

    if(imc < 40){

        return "Obesidade II";

    }

    return "Obesidade III";

}

// ======================================================
// % DE GORDURA — protocolo de Petroski (1995), 4 dobras
// cutâneas (subescapular, tríceps, supra-ilíaca, panturrilha
// medial), convertendo densidade corporal em % de gordura
// pela equação de Siri (1961).
//
// ATENÇÃO — PROVISÓRIO: os coeficientes abaixo foram
// digitados de memória (sem acesso à publicação original no
// momento da implementação). Confira contra Petroski, E.L.
// "Desenvolvimento e validação de equações generalizadas para
// a estimativa da densidade corporal em adultos" (1995) — ou
// outra fonte confiável — antes de usar em avaliações reais.
// ======================================================

export function calcularPercentualGorduraPetroski(dobras, idade, sexo){

    const { subescapular, triceps, suprailiaca, panturrilha } = dobras;

    const somaDobras = subescapular + triceps + suprailiaca + panturrilha;

    let densidadeCorporal;

    if((sexo || "").toLowerCase() === "feminino"){

        densidadeCorporal = 1.19911426 - (0.07545822 * Math.log10(somaDobras)) - (0.00088780 * idade);

    }else{

        densidadeCorporal = 1.10726863 - (0.00081201 * somaDobras) + (0.00000212 * somaDobras * somaDobras) - (0.00041761 * idade);

    }

    // Siri (1961): %G = (495 / densidade) - 450
    const percentualGordura = (495 / densidadeCorporal) - 450;

    return {

        somaDobras: Number(somaDobras.toFixed(1)),
        densidadeCorporal: Number(densidadeCorporal.toFixed(5)),
        percentualGordura: Number(percentualGordura.toFixed(1))

    };

}

// ======================================================
// TELA DE COLETA EM CAMPO
// Mesmo padrão dos outros testes (grid de cards), mas sem
// turma — carrega direto todos os funcionários ativos da
// escola, igual ao Léger adulto.
// ======================================================

let dadosFuncionarios = [];

let filtroAtual = "todos";

let termoBusca = "";

let gridFuncionariosAA, buscaFuncionarioAA, filtrosSituacaoAA;
let areaProgresso, areaFiltros;
let progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaQtdFuncionarios, metaData;
let btnFuncionarioAnterior, btnProximoFuncionario;

function obterElementos(){

    gridFuncionariosAA = document.getElementById("gridFuncionariosAA");
    buscaFuncionarioAA = document.getElementById("buscaFuncionarioAA");
    filtrosSituacaoAA = document.getElementById("filtrosSituacaoAA");
    areaProgresso = document.getElementById("areaProgresso");
    areaFiltros = document.getElementById("areaFiltros");
    progressoContagem = document.getElementById("progressoContagem");
    progressoPreenchimento = document.getElementById("progressoPreenchimento");
    qtdConcluidos = document.getElementById("qtdConcluidos");
    qtdPendentes = document.getElementById("qtdPendentes");
    qtdAusentes = document.getElementById("qtdAusentes");
    metaProfessor = document.getElementById("metaProfessor");
    metaQtdFuncionarios = document.getElementById("metaQtdFuncionarios");
    metaData = document.getElementById("metaData");
    btnFuncionarioAnterior = document.getElementById("btnFuncionarioAnterior");
    btnProximoFuncionario = document.getElementById("btnProximoFuncionario");

}

function configurarEventos(){

    buscaFuncionarioAA.addEventListener("keyup", () => {

        termoBusca = buscaFuncionarioAA.value.trim().toLowerCase();

        renderizarGrid();

    });

    filtrosSituacaoAA.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacaoAA.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoFuncionario.addEventListener("click", () => moverFoco(1));

    btnFuncionarioAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("antropometriaAdulto");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

}

export async function init(){

    obterElementos();

    iniciarPopupTestes();

    iniciarModalComoExecutar();

    const containerIconeTeste = document.getElementById("iconeTesteContainer");

    if(containerIconeTeste){

        containerIconeTeste.innerHTML = iconeTeste("antropometriaAdulto", 56);

    }

    const contexto = obterContextoUsuario();

    metaProfessor.textContent = contexto.nome || "-";

    metaData.textContent = new Date().toLocaleDateString("pt-BR");

    configurarEventos();

    await carregarFuncionarios();

}

function filtroEscola(condicoesExtra = []){

    if(souSuperAdmin()){

        return condicoesExtra;

    }

    return [...condicoesExtra, where("escolaId","==",obterEscolaId())];

}

async function carregarFuncionarios(){

    dadosFuncionarios = [];

    gridFuncionariosAA.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando funcionários...</p>`;

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    try{

        const condicoesFuncionarios = filtroEscola();

        const qFuncionarios = query(collection(db,"funcionarios"), ...condicoesFuncionarios);

        const snapFuncionarios = await getDocs(qFuncionarios);

        const funcionariosAtivos = [];

        snapFuncionarios.forEach(doc=>{

            const dados = { id: doc.id, ...doc.data() };

            if(dados.ativo !== false){

                funcionariosAtivos.push(dados);

            }

        });

        funcionariosAtivos.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_antropometria_adulto"), ...condicoesAvaliacoes);

        const snapAvaliacoes = await getDocs(qAvaliacoes);

        const registrosPorFuncionario = new Map();

        snapAvaliacoes.forEach(doc=>{

            const dados = doc.data();

            if(!registrosPorFuncionario.has(dados.funcionarioId)){

                registrosPorFuncionario.set(dados.funcionarioId, []);

            }

            registrosPorFuncionario.get(dados.funcionarioId).push(dados);

        });

        const hojeISO = new Date().toISOString().slice(0,10);

        metaQtdFuncionarios.textContent = funcionariosAtivos.length;

        dadosFuncionarios = funcionariosAtivos.map(funcionario=>{

            const registros = (registrosPorFuncionario.get(funcionario.id) || []).slice()

                .sort((a,b)=>{

                    const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

                    const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

                    return dataB - dataA;

                });

            const maisRecente = registros[0] || null;

            const dataMaisRecenteISO = maisRecente?.dataTeste ? maisRecente.dataTeste.toDate().toISOString().slice(0,10) : null;

            return {

                funcionario,
                ultimoRegistro: maisRecente,
                avaliadoHoje: dataMaisRecenteISO === hojeISO,
                ausente: false

            };

        });

        renderizarProgresso();

        renderizarGrid();

        areaProgresso.style.display = "block";

        areaFiltros.style.display = "flex";

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os funcionários.", "erro");

    }

}

function renderizarProgresso(){

    const total = dadosFuncionarios.length;

    const concluidos = dadosFuncionarios.filter(d => d.avaliadoHoje).length;

    const ausentes = dadosFuncionarios.filter(d => d.ausente).length;

    const pendentes = total - concluidos - ausentes;

    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    progressoContagem.textContent = `${concluidos} de ${total} funcionários avaliados hoje`;

    progressoPreenchimento.style.width = `${percentual}%`;

    qtdConcluidos.textContent = concluidos;

    qtdPendentes.textContent = pendentes;

    qtdAusentes.textContent = ausentes;

}

function obterListaFiltrada(){

    let lista = dadosFuncionarios;

    if(termoBusca){

        lista = lista.filter(d => (d.funcionario.nome || "").toLowerCase().includes(termoBusca));

    }

    if(filtroAtual === "pendente"){

        lista = lista.filter(d => !d.avaliadoHoje && !d.ausente);

    }else if(filtroAtual === "concluido"){

        lista = lista.filter(d => d.avaliadoHoje);

    }else if(filtroAtual === "ausente"){

        lista = lista.filter(d => d.ausente);

    }else if(filtroAtual === "risco"){

        lista = lista.filter(d => d.ultimoRegistro?.classificacaoIMC?.startsWith("Obesidade") || d.ultimoRegistro?.classificacaoRCE === "Zona de risco à saúde");

    }

    lista = [...lista].sort((a,b) => (a.funcionario.nome || "").localeCompare(b.funcionario.nome || "", "pt-BR"));

    return lista;

}

function renderizarGrid(){

    const lista = obterListaFiltrada();

    if(lista.length === 0){

        gridFuncionariosAA.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum funcionário encontrado com esse filtro.</p>`;

        return;

    }

    gridFuncionariosAA.innerHTML = lista.map(dadosFuncionario => renderizarCard(dadosFuncionario)).join("");

    lista.forEach(dadosFuncionario=>{

        const idFuncionario = dadosFuncionario.funcionario.id;

        const card = document.getElementById(`card-${idFuncionario}`);

        if(!card){
            return;
        }

        card.querySelector(".btn-salvar-card")?.addEventListener("click", () => salvarResultado(idFuncionario));

        card.querySelector(".btn-ausente-card")?.addEventListener("click", () => alternarAusente(idFuncionario));

        card.querySelector(".card-aluno-nome")?.addEventListener("click", () => abrirHistoricoLateral(idFuncionario));

    });

}

function renderizarCard(dadosFuncionario){

    const { funcionario, ultimoRegistro, avaliadoHoje, ausente } = dadosFuncionario;

    const idade = calcularIdade(funcionario.dataNascimento);

    let statusBadge = `<span class="badge-status pendente">⏳ Pendente</span>`;

    if(ausente){

        statusBadge = `<span class="badge-status ausente">❌ Ausente</span>`;

    }else if(avaliadoHoje){

        statusBadge = `<span class="badge-status concluido">✔ Avaliado</span>`;

    }

    const ultimoResultadoTexto = ultimoRegistro

        ? `IMC ${ultimoRegistro.imc ?? "-"} (${ultimoRegistro.classificacaoIMC ?? "-"}) • RCE ${ultimoRegistro.rce ?? "-"} • Gordura ${ultimoRegistro.percentualGordura ?? "-"}%`

        : "Sem registro anterior";

    return `

        <div class="card-aluno-campo ${ausente ? "esmaecido" : ""}" id="card-${funcionario.id}">

            <div class="card-aluno-topo">
                <span class="card-aluno-nome" title="Ver histórico">${funcionario.nome}</span>
                ${statusBadge}
            </div>

            <div class="card-aluno-meta">
                ${idade ? `${idade} anos` : "-"} • ${funcionario.sexo || "-"} • ${funcionario.cargo || "-"}
            </div>

            <div class="card-aluno-ultimo">Último: ${ultimoResultadoTexto}</div>

            ${!ausente ? `

                <div class="card-aluno-entrada campos-antropometria-adulto">

                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-peso" placeholder="peso (kg)" aria-label="Peso de ${funcionario.nome}">
                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-estatura" placeholder="estatura (cm)" aria-label="Estatura de ${funcionario.nome}">
                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-cintura" placeholder="cintura (cm)" aria-label="Cintura de ${funcionario.nome}">
                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-subescapular" placeholder="dobra subescapular (mm)" aria-label="Dobra subescapular de ${funcionario.nome}">
                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-triceps" placeholder="dobra tríceps (mm)" aria-label="Dobra tríceps de ${funcionario.nome}">
                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-suprailiaca" placeholder="dobra supra-ilíaca (mm)" aria-label="Dobra supra-ilíaca de ${funcionario.nome}">
                    <input type="number" step="0.1" min="0" class="form-control input-resultado input-panturrilha" placeholder="dobra panturrilha (mm)" aria-label="Dobra panturrilha de ${funcionario.nome}">

                    <button class="btn btn-primary btn-salvar-card">Salvar</button>

                    <button class="btn-ausente-card" title="Marcar ausente hoje">❌</button>

                </div>

            ` : `

                <button class="btn-secondary btn-ausente-card" style="width:100%;">Desmarcar ausência</button>

            `}

        </div>

    `;

}

function alternarAusente(funcionarioId){

    const dadosFuncionario = dadosFuncionarios.find(d => d.funcionario.id === funcionarioId);

    if(!dadosFuncionario){
        return;
    }

    dadosFuncionario.ausente = !dadosFuncionario.ausente;

    renderizarProgresso();

    renderizarGrid();

}

async function salvarResultado(funcionarioId){

    const dadosFuncionario = dadosFuncionarios.find(d => d.funcionario.id === funcionarioId);

    if(!dadosFuncionario){
        return;
    }

    const card = document.getElementById(`card-${funcionarioId}`);

    const campos = {

        peso: card?.querySelector(".input-peso"),
        estatura: card?.querySelector(".input-estatura"),
        cintura: card?.querySelector(".input-cintura"),
        subescapular: card?.querySelector(".input-subescapular"),
        triceps: card?.querySelector(".input-triceps"),
        suprailiaca: card?.querySelector(".input-suprailiaca"),
        panturrilha: card?.querySelector(".input-panturrilha")

    };

    const algumVazio = Object.values(campos).some(input => !input || input.value === "");

    if(algumVazio){

        mostrarToast("Preencha todos os campos antes de salvar.", "erro");

        return;

    }

    const valores = {};

    for(const chave in campos){

        valores[chave] = Number(campos[chave].value);

        if(isNaN(valores[chave]) || valores[chave] <= 0){

            mostrarToast("Valores inválidos.", "erro");

            return;

        }

    }

    const idade = calcularIdade(dadosFuncionario.funcionario.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Funcionário sem data de nascimento cadastrada — não é possível calcular a composição corporal.", "erro");

        return;

    }

    const sexo = dadosFuncionario.funcionario.sexo;

    const imc = Number(calcularIMCAdulto(valores.peso, valores.estatura).toFixed(1));

    const classificacaoIMC = classificarIMCOMS(imc);

    const rce = Number(calcularRCE(valores.cintura, valores.estatura).toFixed(2));

    const classificacaoRCE = classificarRCEAdulto(rce);

    const { somaDobras, densidadeCorporal, percentualGordura } = calcularPercentualGorduraPetroski({

        subescapular: valores.subescapular,
        triceps: valores.triceps,
        suprailiaca: valores.suprailiaca,
        panturrilha: valores.panturrilha

    }, idade, sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        funcionarioId: dadosFuncionario.funcionario.id,
        nome: dadosFuncionario.funcionario.nome,
        cargo: dadosFuncionario.funcionario.cargo || "",
        escolaId: souSuperAdmin()
            ? (dadosFuncionario.funcionario.escolaId || "")
            : obterEscolaId(),
        avaliadorId: contexto.uid,
        peso: valores.peso,
        estatura: valores.estatura,
        imc,
        classificacaoIMC,
        cintura: valores.cintura,
        rce,
        classificacaoRCE,
        dobraSubescapular: valores.subescapular,
        dobraTriceps: valores.triceps,
        dobraSuprailiaca: valores.suprailiaca,
        dobraPanturrilha: valores.panturrilha,
        somaDobras,
        densidadeCorporal,
        percentualGordura,
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_antropometria_adulto"), avaliacao);

        dadosFuncionario.ultimoRegistro = avaliacao;

        dadosFuncionario.avaliadoHoje = true;

        mostrarToast(`${dadosFuncionario.funcionario.nome}: avaliação salva!`);

        renderizarProgresso();

        renderizarGrid();

        focarProximoPendente(funcionarioId);

    }catch(e){

        console.error(e);

        mostrarToast("Erro ao salvar a avaliação.", "erro");

    }

}

function focarProximoPendente(funcionarioIdAtual){

    const lista = obterListaFiltrada();

    const indiceAtual = lista.findIndex(d => d.funcionario.id === funcionarioIdAtual);

    const proximoPendente = lista.slice(indiceAtual + 1).find(d => !d.avaliadoHoje && !d.ausente);

    if(proximoPendente){

        const proximoCard = document.getElementById(`card-${proximoPendente.funcionario.id}`);

        proximoCard?.scrollIntoView({ behavior:"smooth", block:"center" });

        proximoCard?.querySelector(".input-peso")?.focus();

    }

}

function moverFoco(direcao){

    const lista = obterListaFiltrada();

    if(lista.length === 0){
        return;
    }

    const elementoAtivo = document.activeElement;

    const cardAtivo = elementoAtivo?.closest(".card-aluno-campo");

    let indiceAtual = cardAtivo ? lista.findIndex(d => `card-${d.funcionario.id}` === cardAtivo.id) : -1;

    let proximoIndice = indiceAtual + direcao;

    if(proximoIndice < 0){
        proximoIndice = 0;
    }

    if(proximoIndice >= lista.length){
        proximoIndice = lista.length - 1;
    }

    const alvoCard = document.getElementById(`card-${lista[proximoIndice].funcionario.id}`);

    alvoCard?.scrollIntoView({ behavior:"smooth", block:"center" });

    alvoCard?.querySelector(".input-peso")?.focus();

}

async function abrirHistoricoLateral(funcionarioId){

    const dadosFuncionario = dadosFuncionarios.find(d => d.funcionario.id === funcionarioId);

    if(!dadosFuncionario){
        return;
    }

    document.getElementById("tituloHistoricoLateral").textContent = dadosFuncionario.funcionario.nome;

    const corpo = document.getElementById("corpoHistoricoLateral");

    corpo.innerHTML = `<p style="color:#94a3b8">Carregando...</p>`;

    document.getElementById("painelHistoricoLateral").classList.add("aberto");

    document.getElementById("fundoPainelLateral").classList.add("aberto");

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"avaliacoes_antropometria_adulto"), ...condicoes);

        const snapshot = await getDocs(q);

        const registros = [];

        snapshot.forEach(doc=>{

            const dados = doc.data();

            if(dados.funcionarioId === funcionarioId){

                registros.push(dados);

            }

        });

        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

        if(registros.length === 0){

            corpo.innerHTML = `<p style="color:#94a3b8">Nenhuma avaliação registrada ainda.</p>`;

            return;

        }

        corpo.innerHTML = registros.map(av=>{

            const data = av.dataTeste ? av.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

            return `

                <div class="linha-historico-lateral">
                    <div class="linha-historico-lateral-data">${data}</div>
                    <div class="linha-historico-lateral-valor">IMC ${av.imc ?? "-"} (${av.classificacaoIMC ?? "-"}) • RCE ${av.rce ?? "-"} (${av.classificacaoRCE ?? "-"})</div>
                    <div class="linha-historico-lateral-classificacao">Gordura corporal: ${av.percentualGordura ?? "-"}%</div>
                </div>

            `;

        }).join("");

    }catch(e){

        console.error("Erro ao carregar histórico:", e);

        corpo.innerHTML = `<p style="color:#DC2626">Erro ao carregar histórico.</p>`;

    }

}

function fecharHistoricoLateral(){

    document.getElementById("painelHistoricoLateral").classList.remove("aberto");

    document.getElementById("fundoPainelLateral").classList.remove("aberto");

}
