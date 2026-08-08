//=====================================================
//
// SAFE
// Sistema de Avaliação Física Escolar
//
// Portal do Funcionário — autoatendimento pra adultos da
// escola (professores, motoristas, zeladores etc.), espelhando
// o wizard do aluno (aluno.html / js/modules/alunos.js), mas
// sem turma e só com os 2 testes de adulto (Léger e
// Antropometria Adulta) — o PROESP-Br (bateria dos alunos)
// não entra aqui.
//
// Arquivo:
// js/modules/funcionarioPortal.js
//
//=====================================================

import { db, auth } from "../core/firebase.js";

import {
    signInAnonymously
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {

    collection,

    getDocs,

    addDoc,

    query,

    where,

    Timestamp

}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import { calcularIdade } from "../core/utils.js";

import { iconeTeste } from "../core/testeInfoUI.js";

import { TESTES_INFO } from "../core/testesInfo.js";

import { calcularResultadoLeger, converterVoltasParaEstagio, classificarACSM } from "./leger.js";

import { calcularRCE, classificarSaude as classificarRCEAdulto } from "./circunferenciacintura.js";

import { calcularIMCAdulto, classificarIMCOMS, calcularPercentualGorduraPetroski } from "./antropometriaAdulto.js";

// ======================================================
// CONTROLE DE ACESSO (mesmo padrão anti-força-bruta do
// portal do aluno — ver js/modules/alunos.js)
// ======================================================

const tentativasPorFuncionario = new Map(); // funcionarioId -> { contagem, bloqueadoAte }

const funcionariosAutenticadosNestaSessao = new Set();

// ======================================================
// CONFIGURAÇÃO DOS 2 TESTES DE ADULTO
// ======================================================

const TESTES_CONFIG = {

    leger: {

        titulo: "Léger",
        colecao: "avaliacoes_leger_adulto",
        tempoEstimado: "~10 min",
        campos: [
            { id:"voltasTotais", label:"Total de voltas concluídas", tipo:"number", min:"0", passo:"1", unidade:"voltas" }
        ],
        calcular(valores, idade, sexo){

            const totalVoltas = Number(valores.voltasTotais);

            const { estagioCompleto, voltaNoProximo } = converterVoltasParaEstagio(totalVoltas);

            const resultado = calcularResultadoLeger(estagioCompleto, voltaNoProximo, idade);

            if(!resultado){
                return null;
            }

            return {
                estagio: estagioCompleto,
                volta: voltaNoProximo,
                velocidadeFinal: resultado.velocidade,
                distanciaM: resultado.distanciaM,
                tempoSegundos: resultado.tempoSegundos,
                vo2max: resultado.vo2max,
                classificacao: classificarACSM(resultado.vo2max, idade, sexo)
            };

        },
        resumoFeedback(resultado){

            return [
                { rotulo:"Estágio alcançado", valor: resultado.estagio },
                { rotulo:"VO₂máx estimado", valor: `${resultado.vo2max} mL/kg/min` },
                { rotulo:"Classificação", valor: resultado.classificacao || "Sem classificação (idade fora da tabela)" }
            ];

        }

    },

    antropometriaAdulto: {

        titulo: "Antropometria Adulta",
        colecao: "avaliacoes_antropometria_adulto",
        tempoEstimado: "~5 min",
        // Petroski usa dobras diferentes por sexo — ver comentário de
        // calcularPercentualGorduraPetroski em antropometriaAdulto.js.
        camposPorSexo: {

            masculino: [
                { id:"peso", label:"Peso", tipo:"number", min:"0", passo:"0.1", unidade:"kg" },
                { id:"estatura", label:"Estatura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" },
                { id:"cintura", label:"Cintura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" },
                { id:"subescapular", label:"Dobra subescapular", tipo:"number", min:"0", passo:"0.1", unidade:"mm" },
                { id:"triceps", label:"Dobra tríceps", tipo:"number", min:"0", passo:"0.1", unidade:"mm" },
                { id:"suprailiaca", label:"Dobra supra-ilíaca", tipo:"number", min:"0", passo:"0.1", unidade:"mm" },
                { id:"panturrilha", label:"Dobra panturrilha medial", tipo:"number", min:"0", passo:"0.1", unidade:"mm" }
            ],

            feminino: [
                { id:"peso", label:"Peso", tipo:"number", min:"0", passo:"0.1", unidade:"kg" },
                { id:"estatura", label:"Estatura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" },
                { id:"cintura", label:"Cintura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" },
                { id:"axilarMedia", label:"Dobra axilar média", tipo:"number", min:"0", passo:"0.1", unidade:"mm" },
                { id:"suprailiaca", label:"Dobra supra-ilíaca", tipo:"number", min:"0", passo:"0.1", unidade:"mm" },
                { id:"coxa", label:"Dobra coxa", tipo:"number", min:"0", passo:"0.1", unidade:"mm" },
                { id:"panturrilha", label:"Dobra panturrilha medial", tipo:"number", min:"0", passo:"0.1", unidade:"mm" }
            ]

        },
        calcular(valores, idade, sexo){

            const peso = Number(valores.peso);
            const estatura = Number(valores.estatura);
            const cintura = Number(valores.cintura);

            const imc = Number(calcularIMCAdulto(peso, estatura).toFixed(1));

            const classificacaoIMC = classificarIMCOMS(imc);

            const rce = Number(calcularRCE(cintura, estatura).toFixed(2));

            const classificacaoRCE = classificarRCEAdulto(rce);

            const feminino = (sexo || "").toLowerCase() === "feminino";

            const dobras = feminino ? {

                axilarMedia: Number(valores.axilarMedia),
                suprailiaca: Number(valores.suprailiaca),
                coxa: Number(valores.coxa),
                panturrilha: Number(valores.panturrilha)

            } : {

                subescapular: Number(valores.subescapular),
                triceps: Number(valores.triceps),
                suprailiaca: Number(valores.suprailiaca),
                panturrilha: Number(valores.panturrilha)

            };

            const { somaDobras, densidadeCorporal, percentualGordura } = calcularPercentualGorduraPetroski(dobras, idade, sexo);

            return {

                peso, estatura, imc, classificacaoIMC,
                cintura, rce, classificacaoRCE,
                // As que não se aplicam ficam null (Firestore não aceita "undefined").
                dobraSubescapular: dobras.subescapular ?? null,
                dobraTriceps: dobras.triceps ?? null,
                dobraAxilarMedia: dobras.axilarMedia ?? null,
                dobraCoxa: dobras.coxa ?? null,
                dobraSuprailiaca: dobras.suprailiaca,
                dobraPanturrilha: dobras.panturrilha,
                somaDobras, densidadeCorporal, percentualGordura

            };

        },
        resumoFeedback(resultado){

            return [
                { rotulo:"IMC", valor: `${resultado.imc} (${resultado.classificacaoIMC})` },
                { rotulo:"RCE", valor: `${resultado.rce} (${resultado.classificacaoRCE})` },
                { rotulo:"% de gordura corporal", valor: `${resultado.percentualGordura}%` }
            ];

        }

    }

};

// ======================================================
// ELEMENTOS
// ======================================================

const escolaSelect = document.getElementById("escola");
const buscaNomeFuncionario = document.getElementById("buscaNomeFuncionario");
const listaNomesFuncionarios = document.getElementById("listaNomesFuncionarios");

// ======================================================
// DADOS
// ======================================================

let escolas = [];
let funcionarios = [];
let funcionarioSelecionado = null;
let testeAtualChave = null;

// ======================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ======================================================

function mostrarEtapa(id){

    document.querySelectorAll(".etapa-aluno").forEach(etapa=>{

        etapa.style.display = "none";

    });

    document.getElementById(id).style.display = "flex";

    window.scrollTo(0,0);

}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

document.addEventListener("DOMContentLoaded", iniciar);

async function iniciar(){

    mostrarEtapa("etapaBoasVindas");

    try{

        await signInAnonymously(auth);

    }catch(erro){

        console.error("Erro ao iniciar sessão anônima:", erro);

        alert("Não foi possível abrir o formulário agora. Tente novamente em instantes.");

        return;

    }

    await carregarEscolas();

    configurarEventos();

}

function configurarEventos(){

    document.getElementById("btnComecar").addEventListener("click", () => mostrarEtapa("etapaEscola"));

    document.getElementById("btnVoltarBoasVindas").addEventListener("click", () => mostrarEtapa("etapaBoasVindas"));

    escolaSelect.addEventListener("change", async () => {

        if(!escolaSelect.value){
            return;
        }

        await carregarFuncionarios();

        mostrarEtapa("etapaNome");

    });

    document.getElementById("btnVoltarEscola").addEventListener("click", () => mostrarEtapa("etapaEscola"));

    buscaNomeFuncionario.addEventListener("keyup", () => renderizarListaNomes());

    document.getElementById("btnContinuarIdentificacao").addEventListener("click", () => abrirEscolherTeste());

    document.getElementById("btnVoltarEscolherTeste").addEventListener("click", () => mostrarEtapa("etapaEscolherTeste"));

    document.getElementById("btnEntendiComecar").addEventListener("click", () => abrirLancamento());

    document.getElementById("btnSalvarResultadoFuncionario").addEventListener("click", salvarAvaliacao);

    document.getElementById("btnFazerOutroTeste").addEventListener("click", () => abrirEscolherTeste());

    document.getElementById("cancelarSenhaFuncionario").addEventListener("click", () => {

        funcionarioSelecionado = null;

        mostrarEtapa("etapaNome");

    });

    document.getElementById("confirmarSenhaFuncionario").addEventListener("click", confirmarSenha);

}

// ======================================================
// CARREGAR ESCOLAS / FUNCIONÁRIOS
// ======================================================

async function carregarEscolas(){

    escolas = [];

    escolaSelect.innerHTML = `<option value="">Selecione a escola</option>`;

    const snapshot = await getDocs(collection(db,"escolas"));

    snapshot.forEach(doc=>{

        escolas.push({ id: doc.id, ...doc.data() });

    });

    escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    escolas.forEach(escola=>{

        escolaSelect.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

    });

}

async function carregarFuncionarios(){

    funcionarios = [];

    const consulta = query(collection(db,"funcionarios"), where("escolaId","==",escolaSelect.value));

    const snapshot = await getDocs(consulta);

    snapshot.forEach(doc=>{

        const dados = { id: doc.id, ...doc.data() };

        if(dados.ativo !== false){

            funcionarios.push(dados);

        }

    });

    funcionarios.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    buscaNomeFuncionario.value = "";

    renderizarListaNomes();

}

function renderizarListaNomes(){

    const termo = buscaNomeFuncionario.value.trim().toLowerCase();

    const filtrados = termo

        ? funcionarios.filter(f => (f.nome || "").toLowerCase().includes(termo))

        : funcionarios;

    listaNomesFuncionarios.innerHTML = filtrados.map(f => `

        <div class="item-nome-aluno" data-id="${f.id}">${f.nome}</div>

    `).join("") || `<p style="color:#94a3b8; text-align:center;">Nenhum nome encontrado.</p>`;

    listaNomesFuncionarios.querySelectorAll(".item-nome-aluno").forEach(item=>{

        item.addEventListener("click", () => selecionarFuncionario(item.dataset.id));

    });

}

// ======================================================
// SELECIONAR FUNCIONÁRIO — confirmação de nascimento sempre
// exigida (diferente do aluno, aqui não tem modo "livre"
// configurável por escola — simplificação intencional).
// ======================================================

async function selecionarFuncionario(id){

    funcionarioSelecionado = funcionarios.find(f => f.id === id) || null;

    if(!funcionarioSelecionado){
        return;
    }

    if(funcionariosAutenticadosNestaSessao.has(funcionarioSelecionado.id)){

        abrirIdentificacao();

        return;

    }

    pedirSenhaFuncionario();

}

function pedirSenhaFuncionario(){

    const input = document.getElementById("senhaFuncionarioInput");

    const erro = document.getElementById("erroSenhaFuncionario");

    const estado = tentativasPorFuncionario.get(funcionarioSelecionado.id) || { contagem: 0, bloqueadoAte: 0 };

    const aindaBloqueado = estado.bloqueadoAte > Date.now();

    input.value = "";

    input.disabled = aindaBloqueado;

    document.getElementById("confirmarSenhaFuncionario").disabled = aindaBloqueado;

    erro.style.display = aindaBloqueado ? "block" : "none";

    if(aindaBloqueado){

        erro.textContent = "Muitas tentativas. Aguarde alguns minutos.";

    }

    mostrarEtapa("etapaSenha");

}

async function confirmarSenha(){

    const input = document.getElementById("senhaFuncionarioInput");

    const erro = document.getElementById("erroSenhaFuncionario");

    const estadoAtual = tentativasPorFuncionario.get(funcionarioSelecionado.id) || { contagem: 0, bloqueadoAte: 0 };

    if(estadoAtual.bloqueadoAte > Date.now()){
        return;
    }

    const valorDigitado = input.value;

    input.value = "";

    if(valorDigitado === funcionarioSelecionado.dataNascimento){

        tentativasPorFuncionario.delete(funcionarioSelecionado.id);

        funcionariosAutenticadosNestaSessao.add(funcionarioSelecionado.id);

        abrirIdentificacao();

    }else{

        estadoAtual.contagem++;

        const tentativasMaximas = 5;

        const tempoBloqueioMinutos = 5;

        if(estadoAtual.contagem >= tentativasMaximas){

            estadoAtual.bloqueadoAte = Date.now() + tempoBloqueioMinutos * 60000;

            erro.textContent = "Muitas tentativas. Aguarde alguns minutos.";

            input.disabled = true;

            document.getElementById("confirmarSenhaFuncionario").disabled = true;

        }else{

            erro.textContent = "Data de nascimento incorreta.";

        }

        tentativasPorFuncionario.set(funcionarioSelecionado.id, estadoAtual);

        erro.style.display = "block";

    }

}

// ======================================================
// IDENTIFICAÇÃO
// ======================================================

function abrirIdentificacao(){

    const idade = calcularIdade(funcionarioSelecionado.dataNascimento);

    document.getElementById("nomeIdentificacao").textContent = funcionarioSelecionado.nome;

    document.getElementById("cargoIdadeIdentificacao").textContent =

        `${funcionarioSelecionado.cargo || "-"} — ${typeof idade === "number" ? idade + " anos" : "idade não cadastrada"}`;

    const primeiroNome = (funcionarioSelecionado.nome || "").split(" ")[0];

    document.getElementById("mensagemBoasVindasIdentificacao").textContent =

        `Olá, ${primeiroNome}! Vamos registrar sua avaliação.`;

    mostrarEtapa("etapaIdentificacao");

}

// ======================================================
// ESCOLHER AVALIAÇÃO
// ======================================================

async function abrirEscolherTeste(){

    const grid = document.getElementById("gridTestesFuncionario");

    grid.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando...</p>`;

    mostrarEtapa("etapaEscolherTeste");

    const statusPorTeste = await buscarStatusDeTodosOsTestes();

    grid.innerHTML = Object.entries(TESTES_CONFIG).map(([chave, config])=>{

        const status = statusPorTeste[chave];

        const iconeHtml = iconeTeste(chave, 48);

        const info = TESTES_INFO[chave];

        return `

            <div class="card-teste-aluno ${status.avaliadoHoje ? "concluido" : ""}" data-chave="${chave}">

                <div class="card-teste-aluno-icone">${iconeHtml || "🏃"}</div>

                <h3>${config.titulo}</h3>

                <p class="card-teste-aluno-descricao">${info?.descricao?.slice(0,90) || ""}...</p>

                <div class="card-teste-aluno-rodape">
                    <span>⏱ ${config.tempoEstimado}</span>
                    ${status.avaliadoHoje ? `<span class="badge-status concluido">✔ Feito hoje</span>` : ""}
                </div>

            </div>

        `;

    }).join("");

    grid.querySelectorAll(".card-teste-aluno").forEach(card=>{

        card.addEventListener("click", () => abrirComoFazer(card.dataset.chave));

    });

}

async function buscarStatusDeTodosOsTestes(){

    const resultado = {};

    const hojeISO = new Date().toISOString().slice(0,10);

    await Promise.all(Object.entries(TESTES_CONFIG).map(async ([chave, config])=>{

        const registros = await buscarRegistrosDoFuncionario(config.colecao);

        const maisRecente = registros[0] || null;

        const dataMaisRecenteISO = maisRecente?.dataTeste ? maisRecente.dataTeste.toDate().toISOString().slice(0,10) : null;

        resultado[chave] = {

            registros,
            maisRecente,
            avaliadoHoje: dataMaisRecenteISO === hojeISO

        };

    }));

    return resultado;

}

async function buscarRegistrosDoFuncionario(colecao){

    const registros = [];

    try{

        const consulta = query(collection(db,colecao), where("funcionarioId","==",funcionarioSelecionado.id));

        const snapshot = await getDocs(consulta);

        snapshot.forEach(doc => registros.push(doc.data()));

        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

    }catch(erro){

        console.error(`Erro ao buscar registros de ${colecao}:`, erro);

    }

    return registros;

}

// ======================================================
// COMO FAZER
// ======================================================

function abrirComoFazer(chave){

    testeAtualChave = chave;

    const config = TESTES_CONFIG[chave];

    const info = TESTES_INFO[chave];

    document.getElementById("tituloComoFazerFuncionario").textContent = config.titulo;

    const img = document.getElementById("imgComoFazerFuncionario");

    img.src = info?.imagem || "";

    img.style.display = "block";

    img.onerror = () => { img.style.display = "none"; };

    document.getElementById("descricaoComoFazerFuncionario").textContent = info?.descricao || "";

    const dicas = document.getElementById("dicasComoFazerFuncionario");

    dicas.innerHTML = (info?.criteriosExecucao || []).map(item => `

        <p class="texto-wizard">✅ ${item}</p>

    `).join("");

    mostrarEtapa("etapaComoFazer");

}

// ======================================================
// LANÇAMENTO
// ======================================================

// Alguns testes (ex: antropometriaAdulto) pedem campos diferentes
// dependendo do sexo do funcionário (protocolo de Petroski) — outros
// (ex: leger) têm uma lista única de campos, igual pra todo mundo.
function obterCampos(config, sexo){

    if(config.campos){

        return config.campos;

    }

    const chaveSexo = (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

    return config.camposPorSexo[chaveSexo];

}

function abrirLancamento(){

    const config = TESTES_CONFIG[testeAtualChave];

    const campos = obterCampos(config, funcionarioSelecionado?.sexo);

    const container = document.getElementById("camposLancamentoFuncionario");

    container.innerHTML = campos.map(campo => `

        <div class="campo-lancamento-aluno">

            <label style="display:block; font-size:13px; color:#64748b; margin-bottom:4px;">${campo.label}</label>

            <input
                type="${campo.tipo}"
                id="campo_${campo.id}"
                min="${campo.min ?? ""}"
                step="${campo.passo ?? "any"}"
                inputmode="decimal"
                class="input-gigante-wizard"
                placeholder="0">

            <span class="unidade-lancamento-aluno">${campo.unidade}</span>

        </div>

    `).join("");

    mostrarEtapa("etapaLancamento");

    container.querySelector("input")?.focus();

}

function coletarValores(config, sexo){

    const valores = {};

    for(const campo of obterCampos(config, sexo)){

        const input = document.getElementById(`campo_${campo.id}`);

        if(!input || input.value === "" || Number(input.value) < 0){

            input?.focus();

            input?.classList.add("campo-com-erro");

            return null;

        }

        valores[campo.id] = input.value;

    }

    return valores;

}

async function avaliacaoJaExisteHoje(colecao){

    const hoje = new Date();

    hoje.setHours(0,0,0,0);

    const consulta = query(collection(db,colecao), where("funcionarioId","==",funcionarioSelecionado.id));

    const snapshot = await getDocs(consulta);

    let encontrou = false;

    snapshot.forEach(doc=>{

        const dados = doc.data();

        if(!dados.dataTeste){
            return;
        }

        const data = dados.dataTeste.toDate();

        data.setHours(0,0,0,0);

        if(data.getTime() === hoje.getTime()){

            encontrou = true;

        }

    });

    return encontrou;

}

async function salvarAvaliacao(){

    const btnSalvar = document.getElementById("btnSalvarResultadoFuncionario");

    if(btnSalvar.disabled){
        return;
    }

    btnSalvar.disabled = true;

    const textoOriginalBotao = btnSalvar.textContent;

    btnSalvar.textContent = "Salvando...";

    const config = TESTES_CONFIG[testeAtualChave];

    if(!funcionarioSelecionado.dataNascimento){

        alert("Seu cadastro não tem data de nascimento — fale com a coordenação antes de continuar.");

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        return;

    }

    const valores = coletarValores(config, funcionarioSelecionado.sexo);

    if(!valores){

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        return;

    }

    if(await avaliacaoJaExisteHoje(config.colecao)){

        alert("Você já registrou esse teste hoje. Volte amanhã!");

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        mostrarEtapa("etapaEscolherTeste");

        return;

    }

    const idade = calcularIdade(funcionarioSelecionado.dataNascimento);

    const resultado = config.calcular(valores, idade, funcionarioSelecionado.sexo);

    if(!resultado){

        alert("Não foi possível calcular o resultado com os valores informados.");

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        return;

    }

    const avaliacao = {

        funcionarioId: funcionarioSelecionado.id,
        nome: funcionarioSelecionado.nome,
        cargo: funcionarioSelecionado.cargo || "",
        escolaId: escolaSelect.value,
        avaliadorId: null,
        origem: "funcionario",
        ...resultado,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,config.colecao), avaliacao);

    }catch(erro){

        console.error("Erro ao salvar avaliação:", erro);

        alert("Não foi possível enviar sua avaliação. Tente novamente.");

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        return;

    }

    restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

    try{

        mostrarFeedback(config, resultado);

    }catch(erroExibicao){

        console.error("Erro ao exibir o feedback (o resultado já foi salvo):", erroExibicao);

        mostrarEtapa("etapaEscolherTeste");

    }

}

function restaurarBotaoSalvar(botao, textoOriginal){

    botao.disabled = false;

    botao.textContent = textoOriginal;

}

// ======================================================
// FEEDBACK
// ======================================================

function mostrarFeedback(config, resultado){

    const container = document.getElementById("resumoFeedbackFuncionario");

    container.innerHTML = config.resumoFeedback(resultado).map(item => `

        <div class="linha-historico-lateral" style="text-align:left; margin-bottom:8px;">
            <div style="font-size:13px; color:#64748b;">${item.rotulo}</div>
            <div style="font-size:18px; font-weight:700;">${item.valor}</div>
        </div>

    `).join("");

    mostrarEtapa("etapaFeedback");

}
