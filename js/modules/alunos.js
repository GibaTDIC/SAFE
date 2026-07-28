//=====================================================
//
// SAFE
// Sistema de Avaliação Física Escolar
//
// Portal do Aluno — reformulado como assistente (wizard)
// passo a passo, com painel "Minha Evolução" (gamificação,
// indicadores por capacidade física, linha do tempo).
//
// Arquivo:
// js/modules/alunos.js
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

    Timestamp,

    serverTimestamp

}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
    calcularResultadoLeger,
    calcularIdade,
    classificarFitnessgram,
    converterVoltasParaEstagio
} from "./leger.js";

import { iconeTeste } from "../core/testeInfoUI.js";

import { TESTES_INFO } from "../core/testesInfo.js";

import { classificarSafeScore } from "../core/safeScore.js";

import { calcularRCE, classificarSaude as classificarSaudeCintura } from "./circunferenciacintura.js";

import { calcularIMC, classificarSaude as classificarSaudeImc } from "./imc.js";

import { classificarDesempenho as classificarDesempenhoFlex, classificarSaude as classificarSaudeFlex } from "./flexibilidade.js";

import { classificarDesempenho as classificarDesempenhoAbd, classificarSaude as classificarSaudeAbd } from "./abdominal.js";

import { classificarDesempenho as classificarDesempenhoMB, classificarSaude as classificarSaudeMB } from "./medicineball.js";

import { classificarDesempenho as classificarDesempenhoSH } from "./saltohorizontal.js";

import { classificarDesempenho as classificarDesempenhoAgi } from "./agilidade.js";

import { classificarDesempenho as classificarDesempenho20m, classificarSaude as classificarSaude20m } from "./corrida20m.js";

import { classificarDesempenho as classificarDesempenho6min, classificarSaude as classificarSaude6min } from "./corrida6min.js";

// ======================================================
// CONTROLE DE ACESSO DO ALUNO (preservado exatamente como
// já validamos — não reduz a segurança que construímos)
// ======================================================

const tentativasPorAluno = new Map(); // alunoId -> { contagem, bloqueadoAte }

const alunosAutenticadosNestaSessao = new Set(); // alunoId (só nessa aba, até recarregar)

let horarioAutenticacao = null;

// ======================================================
// CONFIGURAÇÃO DOS 9 TESTES
// ======================================================

const CATEGORIAS_DESEMPENHO = ["Fraco","Razoável","Bom","Muito Bom","Excelência"];
const CATEGORIAS_LEGER = ["Zona de risco à saúde","Precisa melhorar","Zona saudável"];
const CATEGORIAS_IMC = ["Zona de risco à saúde","Zona saudável"];

const TESTES_CONFIG = {

    leger: {

        titulo: "Léger",
        colecao: "avaliacoes_leger",
        capacidade: "Resistência Cardiorrespiratória",
        tempoEstimado: "~10 min",
        campos: [
            { id:"voltasTotais", label:"Total de voltas concluídas", tipo:"number", min:"0", passo:"1", unidade:"voltas" }
        ],
        campoPosicao: "classificacao",
        categoriasPosicao: CATEGORIAS_LEGER,
        campoValorPrincipal: "vo2max",
        mostrarEsforcoSensacao: true,
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
                classificacao: classificarFitnessgram(resultado.vo2max, idade, sexo)
            };

        },
        colunas: [
            { label:"Estágio", campo:"estagio" },
            { label:"VO₂máx", campo:"vo2max" },
            { label:"Classificação", campo:"classificacao" }
        ]

    },

    circunferenciacintura: {

        titulo: "Perímetro da Cintura",
        colecao: "avaliacoes_circunferenciacintura",
        capacidade: "Composição Corporal",
        tempoEstimado: "~2 min",
        campos: [
            { id:"cintura", label:"Cintura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" },
            { id:"estatura", label:"Estatura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" }
        ],
        campoPosicao: "classificacaoSaude",
        categoriasPosicao: CATEGORIAS_IMC,
        campoValorPrincipal: "rce",
        calcular(valores){

            const cintura = Number(valores.cintura);
            const estatura = Number(valores.estatura);

            const rce = Number(calcularRCE(cintura, estatura).toFixed(2));

            return {
                cintura,
                estatura,
                rce,
                classificacaoSaude: classificarSaudeCintura(rce)
            };

        },
        colunas: [
            { label:"RCE", campo:"rce" },
            { label:"Classificação", campo:"classificacaoSaude" }
        ]

    },

    imc: {

        titulo: "IMC",
        colecao: "avaliacoes_imc",
        capacidade: "Composição Corporal",
        tempoEstimado: "~2 min",
        campos: [
            { id:"peso", label:"Peso", tipo:"number", min:"0", passo:"0.1", unidade:"kg" },
            { id:"estatura", label:"Estatura", tipo:"number", min:"0", passo:"0.1", unidade:"cm" }
        ],
        campoPosicao: "classificacaoSaude",
        categoriasPosicao: CATEGORIAS_IMC,
        campoValorPrincipal: "imc",
        calcular(valores, idade, sexo){

            const peso = Number(valores.peso);
            const estatura = Number(valores.estatura);

            const imc = Number(calcularIMC(peso, estatura).toFixed(1));

            return {
                peso,
                estatura,
                imc,
                classificacaoSaude: classificarSaudeImc(imc, idade, sexo)
            };

        },
        colunas: [
            { label:"IMC", campo:"imc" },
            { label:"Classificação", campo:"classificacaoSaude" }
        ]

    },

    flexibilidade: {

        titulo: "Flexibilidade",
        colecao: "avaliacoes_flexibilidade",
        capacidade: "Flexibilidade",
        tempoEstimado: "~3 min",
        campos: [
            { id:"distanciaCm", label:"Distância alcançada", tipo:"number", min:"0", passo:"0.1", unidade:"cm" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "distanciaCm",
        calcular(valores, idade, sexo){

            const distanciaCm = Number(valores.distanciaCm);

            return {
                distanciaCm,
                classificacaoDesempenho: classificarDesempenhoFlex(distanciaCm, idade, sexo),
                classificacaoSaude: classificarSaudeFlex(distanciaCm, idade, sexo)
            };

        },
        colunas: [
            { label:"Distância (cm)", campo:"distanciaCm" },
            { label:"Desempenho", campo:"classificacaoDesempenho" },
            { label:"Saúde", campo:"classificacaoSaude" }
        ]

    },

    abdominal: {

        titulo: "Resistência Muscular (Abdominal)",
        colecao: "avaliacoes_abdominal",
        capacidade: "Força / Resistência Muscular",
        tempoEstimado: "~2 min",
        campos: [
            { id:"repeticoes", label:"Repetições em 1 minuto", tipo:"number", min:"0", passo:"1", unidade:"repetições" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "repeticoes",
        calcular(valores, idade, sexo){

            const repeticoes = Number(valores.repeticoes);

            return {
                repeticoes,
                classificacaoDesempenho: classificarDesempenhoAbd(repeticoes, idade, sexo),
                classificacaoSaude: classificarSaudeAbd(repeticoes, idade, sexo)
            };

        },
        colunas: [
            { label:"Repetições", campo:"repeticoes" },
            { label:"Desempenho", campo:"classificacaoDesempenho" },
            { label:"Saúde", campo:"classificacaoSaude" }
        ]

    },

    medicineball: {

        titulo: "Potência Superior (Medicine Ball)",
        colecao: "avaliacoes_medicineball",
        capacidade: "Potência Muscular",
        tempoEstimado: "~3 min",
        campos: [
            { id:"distanciaCm", label:"Distância do arremesso", tipo:"number", min:"0", passo:"0.1", unidade:"cm" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "distanciaCm",
        calcular(valores, idade, sexo){

            const distanciaCm = Number(valores.distanciaCm);

            return {
                distanciaCm,
                classificacaoDesempenho: classificarDesempenhoMB(distanciaCm, idade, sexo),
                classificacaoSaude: classificarSaudeMB(distanciaCm, idade, sexo)
            };

        },
        colunas: [
            { label:"Distância (cm)", campo:"distanciaCm" },
            { label:"Desempenho", campo:"classificacaoDesempenho" },
            { label:"Saúde", campo:"classificacaoSaude" }
        ]

    },

    saltohorizontal: {

        titulo: "Potência Inferior (Salto Horizontal)",
        colecao: "avaliacoes_saltohorizontal",
        capacidade: "Potência Muscular",
        tempoEstimado: "~3 min",
        campos: [
            { id:"distanciaCm", label:"Distância do salto", tipo:"number", min:"0", passo:"0.1", unidade:"cm" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "distanciaCm",
        calcular(valores, idade, sexo){

            const distanciaCm = Number(valores.distanciaCm);

            return {
                distanciaCm,
                classificacaoDesempenho: classificarDesempenhoSH(distanciaCm, idade, sexo)
            };

        },
        colunas: [
            { label:"Distância (cm)", campo:"distanciaCm" },
            { label:"Desempenho", campo:"classificacaoDesempenho" }
        ]

    },

    agilidade: {

        titulo: "Agilidade (Quadrado 4x4m)",
        colecao: "avaliacoes_agilidade",
        capacidade: "Agilidade",
        tempoEstimado: "~2 min",
        campos: [
            { id:"tempoSegundos", label:"Tempo", tipo:"number", min:"0", passo:"0.01", unidade:"segundos" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "tempoSegundos",
        calcular(valores, idade, sexo){

            const tempoSegundos = Number(valores.tempoSegundos);

            return {
                tempoSegundos,
                classificacaoDesempenho: classificarDesempenhoAgi(tempoSegundos, idade, sexo)
            };

        },
        colunas: [
            { label:"Tempo (s)", campo:"tempoSegundos" },
            { label:"Desempenho", campo:"classificacaoDesempenho" }
        ]

    },

    corrida20m: {

        titulo: "Velocidade (Corrida 20m)",
        colecao: "avaliacoes_corrida20m",
        capacidade: "Velocidade",
        tempoEstimado: "~2 min",
        campos: [
            { id:"tempoSegundos", label:"Tempo", tipo:"number", min:"0", passo:"0.01", unidade:"segundos" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "tempoSegundos",
        calcular(valores, idade, sexo){

            const tempoSegundos = Number(valores.tempoSegundos);

            return {
                tempoSegundos,
                classificacaoDesempenho: classificarDesempenho20m(tempoSegundos, idade, sexo),
                classificacaoSaude: classificarSaude20m(tempoSegundos, idade, sexo)
            };

        },
        colunas: [
            { label:"Tempo (s)", campo:"tempoSegundos" },
            { label:"Desempenho", campo:"classificacaoDesempenho" },
            { label:"Saúde", campo:"classificacaoSaude" }
        ]

    },

    corrida6min: {

        titulo: "Aptidão Cardiorrespiratória (6min)",
        colecao: "avaliacoes_corrida6min",
        capacidade: "Resistência Cardiorrespiratória",
        tempoEstimado: "~7 min",
        campos: [
            { id:"distanciaM", label:"Distância percorrida", tipo:"number", min:"0", passo:"1", unidade:"m" }
        ],
        campoPosicao: "classificacaoDesempenho",
        categoriasPosicao: CATEGORIAS_DESEMPENHO,
        campoValorPrincipal: "distanciaM",
        calcular(valores, idade, sexo){

            const distanciaM = Number(valores.distanciaM);

            return {
                distanciaM,
                classificacaoDesempenho: classificarDesempenho6min(distanciaM, idade, sexo),
                classificacaoSaude: classificarSaude6min(distanciaM, idade, sexo)
            };

        },
        colunas: [
            { label:"Distância (m)", campo:"distanciaM" },
            { label:"Desempenho", campo:"classificacaoDesempenho" },
            { label:"Saúde", campo:"classificacaoSaude" }
        ]

    }

};

// Calcula a "posição" 0-100 (0=pior, 100=melhor) de um registro,
// usada pro SAFE Score e pra barra de evolução.
function calcularPosicao(config, registro){

    if(!registro){
        return null;
    }

    const categoria = registro[config.campoPosicao];

    const indice = config.categoriasPosicao.indexOf(categoria);

    if(indice === -1){
        return null;
    }

    return config.categoriasPosicao.length > 1

        ? (indice / (config.categoriasPosicao.length - 1)) * 100

        : 50;

}

// ======================================================
// ELEMENTOS
// ======================================================

const escolaSelect = document.getElementById("escola");
const turmaSelect = document.getElementById("turma");
const buscaNomeAluno = document.getElementById("buscaNomeAluno");
const listaNomesAlunos = document.getElementById("listaNomesAlunos");
const listaMeusResultados = document.getElementById("listaMeusResultados");

// ======================================================
// DADOS
// ======================================================

let escolas = [];
let turmas = [];
let alunos = [];
let alunoSelecionado = null;
let testeAtualChave = null;
let historicoAtualDoTeste = []; // do teste em andamento, ANTES de salvar o novo

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

    // Sem isso, TODAS as etapas ficam escondidas (é o padrão da
    // classe .etapa-aluno) e a página aparece em branco.
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

        await carregarTurmas();

        mostrarEtapa("etapaTurma");

    });

    document.getElementById("btnVoltarEscola").addEventListener("click", () => mostrarEtapa("etapaEscola"));

    turmaSelect.addEventListener("change", async () => {

        if(!turmaSelect.value){
            return;
        }

        await carregarAlunos();

        mostrarEtapa("etapaNome");

    });

    document.getElementById("btnVoltarTurma").addEventListener("click", () => mostrarEtapa("etapaTurma"));

    buscaNomeAluno.addEventListener("keyup", () => renderizarListaNomes());

    document.getElementById("btnContinuarIdentificacao").addEventListener("click", () => abrirEscolherTeste());

    document.getElementById("btnVerDashboardDoTopo").addEventListener("click", () => abrirDashboard());

    document.getElementById("btnVoltarEscolherTeste").addEventListener("click", () => mostrarEtapa("etapaEscolherTeste"));

    document.getElementById("btnEntendiComecar").addEventListener("click", () => abrirLancamento());

    document.getElementById("btnSalvarResultadoAluno").addEventListener("click", salvarAvaliacao);

    document.getElementById("btnFazerOutroTeste").addEventListener("click", () => abrirEscolherTeste());

    document.getElementById("btnVerMeuPainel").addEventListener("click", () => abrirDashboard());

    document.getElementById("btnVoltarEscolherTesteDoDashboard").addEventListener("click", () => abrirEscolherTeste());

    document.getElementById("cancelarSenhaAluno").addEventListener("click", () => {

        alunoSelecionado = null;

        mostrarEtapa("etapaNome");

    });

    document.getElementById("confirmarSenhaAluno").addEventListener("click", confirmarSenha);

}

// ======================================================
// CARREGAR ESCOLAS / TURMAS / ALUNOS
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

async function carregarTurmas(){

    turmas = [];

    turmaSelect.innerHTML = `<option value="">Selecione a turma</option>`;

    const consulta = query(collection(db,"turmas"), where("escolaId","==",escolaSelect.value));

    const snapshot = await getDocs(consulta);

    snapshot.forEach(doc=>{

        turmas.push({ id: doc.id, ...doc.data() });

    });

    turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    turmas.forEach(turma=>{

        turmaSelect.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

    });

}

async function carregarAlunos(){

    alunos = [];

    const consulta = query(collection(db,"alunos"), where("escolaId","==",escolaSelect.value));

    const snapshot = await getDocs(consulta);

    snapshot.forEach(doc=>{

        const dadosAluno = { id: doc.id, ...doc.data() };

        if(dadosAluno.turmaId === turmaSelect.value){

            alunos.push(dadosAluno);

        }

    });

    alunos.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    buscaNomeAluno.value = "";

    renderizarListaNomes();

}

function renderizarListaNomes(){

    const termo = buscaNomeAluno.value.trim().toLowerCase();

    const filtrados = termo

        ? alunos.filter(a => (a.nome || "").toLowerCase().includes(termo))

        : alunos;

    listaNomesAlunos.innerHTML = filtrados.map(a => `

        <div class="item-nome-aluno" data-id="${a.id}">${a.nome}</div>

    `).join("") || `<p style="color:#94a3b8; text-align:center;">Nenhum nome encontrado.</p>`;

    listaNomesAlunos.querySelectorAll(".item-nome-aluno").forEach(item=>{

        item.addEventListener("click", () => selecionarAluno(item.dataset.id));

    });

}

// ======================================================
// SELECIONAR ALUNO — árvore de decisão de senha preservada
// ======================================================

async function selecionarAluno(alunoId){

    alunoSelecionado = alunos.find(a => a.id === alunoId) || null;

    if(!alunoSelecionado){
        return;
    }

    if(alunosAutenticadosNestaSessao.has(alunoSelecionado.id)){

        await abrirIdentificacao(true);

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turmaSelect.value);

    if(precisaSenha(alunoSelecionado, turmaAtual)){

        pedirSenhaAluno();

        return;

    }

    await registrarAcesso("livre");

    await abrirIdentificacao(false);

}

function precisaSenha(aluno, turma){

    const escolaAtual = escolas.find(e => e.id === escolaSelect.value) || {};

    const modoAcesso = escolaAtual.modoAcessoAluno

        || (escolaAtual.exigirSenhaAluno === true ? "senhaNascimento" : "livre");

    const idadeMinima = escolaAtual.idadeMinimaSenha ?? 12;

    const idade = calcularIdade(aluno.dataNascimento);

    console.log("SAFE DEBUG — precisaSenha:", {

        aluno: aluno.nome,
        turmaExigeSenha: turma?.exigirSenha === true,
        turmaEncontrada: !!turma,
        modoAcessoDaEscola: modoAcesso,
        idadeMinimaConfigurada: idadeMinima,
        idadeDoAluno: idade

    });

    if(turma?.exigirSenha === true){

        return true;

    }

    if(modoAcesso !== "senhaNascimento"){

        return false;

    }

    if(typeof idade === "number" && idade >= idadeMinima){

        return true;

    }

    return false;

}

function pedirSenhaAluno(){

    const input = document.getElementById("senhaAlunoInput");

    const erro = document.getElementById("erroSenhaAluno");

    const estado = tentativasPorAluno.get(alunoSelecionado.id) || { contagem: 0, bloqueadoAte: 0 };

    const aindaBloqueado = estado.bloqueadoAte > Date.now();

    input.value = "";

    input.disabled = aindaBloqueado;

    document.getElementById("confirmarSenhaAluno").disabled = aindaBloqueado;

    erro.style.display = aindaBloqueado ? "block" : "none";

    if(aindaBloqueado){

        erro.textContent = "Muitas tentativas. Aguarde alguns minutos.";

    }

    mostrarEtapa("etapaSenha");

}

async function confirmarSenha(){

    const input = document.getElementById("senhaAlunoInput");

    const erro = document.getElementById("erroSenhaAluno");

    const estadoAtual = tentativasPorAluno.get(alunoSelecionado.id) || { contagem: 0, bloqueadoAte: 0 };

    if(estadoAtual.bloqueadoAte > Date.now()){
        return;
    }

    const valorDigitado = input.value;

    input.value = "";

    if(valorDigitado === alunoSelecionado.dataNascimento){

        tentativasPorAluno.delete(alunoSelecionado.id);

        alunosAutenticadosNestaSessao.add(alunoSelecionado.id);

        await registrarAcesso("autenticado");

        await abrirIdentificacao(true);

    }else{

        estadoAtual.contagem++;

        const escolaAtual = escolas.find(e => e.id === escolaSelect.value) || {};

        const tentativasMaximas = escolaAtual.tentativasMaximas ?? 5;

        const tempoBloqueioMinutos = escolaAtual.tempoBloqueioMinutos ?? 5;

        if(estadoAtual.contagem >= tentativasMaximas){

            estadoAtual.bloqueadoAte = Date.now() + tempoBloqueioMinutos * 60000;

            erro.textContent = "Muitas tentativas. Aguarde alguns minutos.";

            input.disabled = true;

            document.getElementById("confirmarSenhaAluno").disabled = true;

        }else{

            erro.textContent = "Data de nascimento incorreta.";

        }

        tentativasPorAluno.set(alunoSelecionado.id, estadoAtual);

        erro.style.display = "block";

    }

}

// ======================================================
// REGISTRO DE AUDITORIA
// ======================================================

async function registrarAcesso(tipoAcesso){

    try{

        const turmaAtual = turmas.find(t => t.id === turmaSelect.value);

        await addDoc(collection(db,"auditoria_acesso_aluno"), {

            dataHora: serverTimestamp(),
            alunoId: alunoSelecionado.id,
            alunoNome: alunoSelecionado.nome,
            turmaId: turmaSelect.value,
            turmaNome: turmaAtual?.nome || "-",
            escolaId: escolaSelect.value,
            dispositivo: navigator.userAgent,
            tipoAcesso

        });

    }catch(erro){

        console.error("Erro ao registrar auditoria de acesso (não bloqueia o aluno):", erro);

    }

}

// ======================================================
// ETAPA 6: IDENTIFICAÇÃO
// ======================================================

async function abrirIdentificacao(autenticado){

    if(autenticado && !horarioAutenticacao){

        horarioAutenticacao = new Date();

    }

    if(!autenticado){

        horarioAutenticacao = null;

    }

    const idade = calcularIdade(alunoSelecionado.dataNascimento);

    const turmaAtual = turmas.find(t => t.id === turmaSelect.value);

    document.getElementById("nomeIdentificacao").textContent = alunoSelecionado.nome;

    document.getElementById("turmaIdadeIdentificacao").textContent =

        `Turma ${turmaAtual?.nome || "-"} — ${typeof idade === "number" ? idade + " anos" : "idade não cadastrada"}`;

    const primeiroNome = (alunoSelecionado.nome || "").split(" ")[0];

    document.getElementById("mensagemBoasVindasIdentificacao").textContent =

        `Olá, ${primeiroNome}! Vamos registrar sua avaliação.`;

    mostrarEtapa("etapaIdentificacao");

}

// ======================================================
// ETAPA 7: ESCOLHER AVALIAÇÃO
// ======================================================

async function abrirEscolherTeste(){

    const gridTestesAluno = document.getElementById("gridTestesAluno");

    gridTestesAluno.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando...</p>`;

    mostrarEtapa("etapaEscolherTeste");

    const statusPorTeste = await buscarStatusDeTodosOsTestes();

    gridTestesAluno.innerHTML = Object.entries(TESTES_CONFIG).map(([chave, config])=>{

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

    gridTestesAluno.querySelectorAll(".card-teste-aluno").forEach(card=>{

        card.addEventListener("click", () => abrirComoFazer(card.dataset.chave));

    });

}

async function buscarStatusDeTodosOsTestes(){

    const resultado = {};

    await Promise.all(Object.entries(TESTES_CONFIG).map(async ([chave, config])=>{

        const registros = await buscarRegistrosDoAluno(config.colecao);

        const hojeISO = new Date().toISOString().slice(0,10);

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

async function buscarRegistrosDoAluno(colecao){

    const registros = [];

    try{

        const consulta = query(collection(db,colecao), where("alunoId","==",alunoSelecionado.id));

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
// ETAPA 8: COMO FAZER
// ======================================================

async function abrirComoFazer(chave){

    testeAtualChave = chave;

    const config = TESTES_CONFIG[chave];

    const info = TESTES_INFO[chave];

    document.getElementById("tituloComoFazerAluno").textContent = config.titulo;

    const img = document.getElementById("imgComoFazerAluno");

    img.src = info?.imagem || "";

    img.style.display = "block";

    img.onerror = () => { img.style.display = "none"; };

    document.getElementById("descricaoComoFazerAluno").textContent = info?.descricao || "";

    const dicas = document.getElementById("dicasComoFazerAluno");

    dicas.innerHTML = (info?.criteriosExecucao || []).map(item => `

        <p class="texto-wizard">✅ ${item}</p>

    `).join("");

    historicoAtualDoTeste = await buscarRegistrosDoAluno(config.colecao);

    mostrarEtapa("etapaComoFazer");

}

// ======================================================
// ETAPA 9: LANÇAMENTO
// ======================================================

function abrirLancamento(){

    const config = TESTES_CONFIG[testeAtualChave];

    const container = document.getElementById("camposLancamentoAluno");

    container.innerHTML = config.campos.map(campo => `

        <div class="campo-lancamento-aluno">

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

function coletarValores(config){

    const valores = {};

    for(const campo of config.campos){

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

    const consulta = query(

        collection(db,colecao),

        where("alunoId","==",alunoSelecionado.id)

    );

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

    const btnSalvar = document.getElementById("btnSalvarResultadoAluno");

    // Evita duplo clique / clique repetido por achar que travou
    if(btnSalvar.disabled){
        return;
    }

    btnSalvar.disabled = true;

    const textoOriginalBotao = btnSalvar.textContent;

    btnSalvar.textContent = "Salvando...";

    const config = TESTES_CONFIG[testeAtualChave];

    if(!alunoSelecionado.dataNascimento){

        alert("Seu cadastro não tem data de nascimento — fale com o professor antes de continuar.");

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        return;

    }

    const valores = coletarValores(config);

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

    const idade = calcularIdade(alunoSelecionado.dataNascimento);

    const resultado = config.calcular(valores, idade, alunoSelecionado.sexo);

    if(!resultado){

        alert("Não foi possível calcular o resultado com os valores informados.");

        restaurarBotaoSalvar(btnSalvar, textoOriginalBotao);

        return;

    }

    const avaliacao = {

        alunoId: alunoSelecionado.id,
        nome: alunoSelecionado.nome,
        codigoSAFE: alunoSelecionado.codigoSAFE || "",
        turmaId: turmaSelect.value,
        escolaId: escolaSelect.value,
        professorId: null,
        origem: "aluno",
        ...resultado,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    // IMPORTANTE: o salvamento (addDoc) e a exibição do feedback ficam
    // em blocos separados. Se algo der errado só na EXIBIÇÃO depois de
    // já ter salvo com sucesso, o aluno não pode ver uma mensagem de
    // "erro ao salvar" — o registro já existe. Por isso mostrarFeedback
    // tem seu próprio try/catch, que nunca deixa a tela travada.
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

        // O registro JÁ foi salvo com sucesso (linha acima) — um erro
        // aqui é só de exibição, nunca deve ser confundido com falha
        // de salvamento nem travar o aluno na mesma tela.
        console.error("Erro ao exibir o feedback (o resultado já foi salvo):", erroExibicao);

        mostrarEtapa("etapaEscolherTeste");

    }

}

function restaurarBotaoSalvar(botao, textoOriginal){

    botao.disabled = false;

    botao.textContent = textoOriginal;

}

// ======================================================
// ETAPA 10: FEEDBACK
// ======================================================

function mostrarFeedback(config, resultado){

    const posicaoAtual = calcularPosicao(config, resultado);

    const faixa = posicaoAtual !== null ? classificarSafeScore(posicaoAtual) : null;

    const emoji = document.getElementById("emojiClassificacaoAluno");

    const texto = document.getElementById("textoClassificacaoAluno");

    const valorEl = document.getElementById("valorResultadoAluno");

    const cartao = document.getElementById("cartaoClassificacaoAluno");

    const campoPrincipal = config.campoValorPrincipal;

    valorEl.textContent = `${resultado[campoPrincipal] ?? ""} ${config.campos[0]?.unidade || ""}`;

    if(faixa){

        emoji.textContent = faixa.emoji;

        texto.textContent = faixa.label;

        cartao.style.borderColor = faixa.cor;

        cartao.style.background = `${faixa.corFundo}55`;

    }else{

        emoji.textContent = "📋";

        texto.textContent = resultado[config.campoPosicao] || "Registrado";

        cartao.style.borderColor = "#94a3b8";

        cartao.style.background = "#F1F5F9";

    }

    document.getElementById("explicacaoResultadoAluno").textContent = obterExplicacaoSimples(faixa?.label);

    document.getElementById("mensagemMotivacionalAluno").textContent = obterMensagemMotivacional();

    const areaEvolucao = document.getElementById("areaEvolucaoAluno");

    const anterior = historicoAtualDoTeste[0];

    if(anterior){

        const posicaoAnterior = calcularPosicao(config, anterior);

        if(posicaoAnterior !== null && posicaoAtual !== null){

            const diferenca = posicaoAtual - posicaoAnterior;

            const seta = diferenca > 2 ? "↑ Melhorou" : diferenca < -2 ? "↓ Piorou" : "→ Manteve";

            const corSeta = diferenca > 2 ? "#16A34A" : diferenca < -2 ? "#DC2626" : "#64748b";

            areaEvolucao.innerHTML = `

                <div class="barra-evolucao-aluno">

                    <div class="barra-evolucao-aluno-item">
                        <span>Antes</span>
                        <div class="barra-evolucao-trilha"><div style="width:${posicaoAnterior}%; background:${classificarSafeScore(posicaoAnterior)?.cor || "#94a3b8"};"></div></div>
                    </div>

                    <div class="barra-evolucao-aluno-item">
                        <span>Hoje</span>
                        <div class="barra-evolucao-trilha"><div style="width:${posicaoAtual}%; background:${classificarSafeScore(posicaoAtual)?.cor || "#94a3b8"};"></div></div>
                    </div>

                    <p style="color:${corSeta}; font-weight:800; text-align:center; margin-top:8px;">${seta}</p>

                </div>

            `;

        }else{

            areaEvolucao.innerHTML = "";

        }

    }else{

        areaEvolucao.innerHTML = `<p class="texto-wizard">Essa foi sua primeira vez nesse teste — a partir de agora dá pra acompanhar sua evolução aqui! 🎯</p>`;

    }

    mostrarEtapa("etapaFeedback");

}

function obterExplicacaoSimples(faixaLabel){

    if(faixaLabel === "Risco"){

        return "Você pode melhorar sua aptidão física com exercícios orientados pelo professor.";

    }

    if(faixaLabel === "Atenção"){

        return "Está quase lá! Com um pouco mais de prática você chega na próxima faixa.";

    }

    if(faixaLabel === "Excelência"){

        return "Excelente! Seu resultado está entre os melhores pra sua idade. Continue assim!";

    }

    return "Seu resultado está dentro da faixa esperada para sua idade. Continue praticando atividades físicas regularmente.";

}

function obterMensagemMotivacional(){

    const mensagens = ["Muito bem!", "Parabéns!", "Continue assim!", "Você está evoluindo!", "Excelente esforço!"];

    return mensagens[Math.floor(Math.random() * mensagens.length)];

}

// ======================================================
// ETAPA 11: DASHBOARD / MINHA EVOLUÇÃO
// ======================================================

async function abrirDashboard(){

    mostrarEtapa("etapaDashboard");

    document.getElementById("resumoDashboardAluno").innerHTML = `<div class="card"><p style="color:#94a3b8">Carregando...</p></div>`;

    const statusPorTeste = await buscarStatusDeTodosOsTestes();

    const posicoes = Object.entries(TESTES_CONFIG)

        .map(([chave, config]) => ({ chave, config, posicao: calcularPosicao(config, statusPorTeste[chave].maisRecente) }))

        .filter(item => item.posicao !== null);

    const testesFeitos = Object.values(statusPorTeste).filter(s => s.registros.length > 0).length;

    // Nunca mais hardcoded — se um teste novo for adicionado no futuro,
    // isso se atualiza sozinho.
    const totalDeTestes = Object.keys(TESTES_CONFIG).length;

    // Total de avaliações registradas — diferente de "testesFeitos": esse
    // conta TODAS as vezes que o aluno já testou, incluindo repetições em
    // dias diferentes (o "X de 9" é só quantos TIPOS de teste já foram
    // feitos ao menos uma vez, e trava em 9 porque só existem 9 testes).
    const totalRegistros = Object.values(statusPorTeste).reduce((soma, s) => soma + s.registros.length, 0);

    // ---- CARDS RESUMO ----
    try{

        const safeScoreGeral = posicoes.length > 0

            ? posicoes.reduce((soma, p) => soma + p.posicao, 0) / posicoes.length

            : null;

        const faixaGeral = safeScoreGeral !== null ? classificarSafeScore(safeScoreGeral) : null;

        document.getElementById("resumoDashboardAluno").innerHTML = `

            <div class="card"><h3>Meu SAFE Score</h3><h1 style="color:${faixaGeral?.cor || "inherit"}">${safeScoreGeral !== null ? Math.round(safeScoreGeral) : "-"}</h1></div>
            <div class="card"><h3>Classificação Geral</h3><h1 style="color:${faixaGeral?.cor || "inherit"}; font-size:22px;">${faixaGeral ? `${faixaGeral.emoji} ${faixaGeral.label}` : "Sem dados"}</h1></div>
            <div class="card"><h3>Tipos de Teste Feitos</h3><h1>${testesFeitos} de ${totalDeTestes}</h1></div>
            <div class="card"><h3>Total de Avaliações</h3><h1>${totalRegistros}</h1></div>

        `;

    }catch(erro){

        console.error("Erro ao montar os cards resumo:", erro);

    }

    // ---- BARRA DE PROGRESSO ----
    try{

        const percentual = Math.round((testesFeitos / totalDeTestes) * 100);

        document.getElementById("progressoTestesTexto").textContent =

            `Você já fez ${testesFeitos} dos ${totalDeTestes} tipos de teste ao menos uma vez (${totalRegistros} avaliações no total, contando repetições)`;

        document.getElementById("progressoTestesPreenchimento").style.width = `${percentual}%`;

    }catch(erro){

        console.error("Erro ao montar a barra de progresso:", erro);

    }

    // ---- INDICADORES POR CAPACIDADE ----
    try{

        const capacidades = new Map();

        posicoes.forEach(({ config, posicao })=>{

            if(!capacidades.has(config.capacidade)){

                capacidades.set(config.capacidade, []);

            }

            capacidades.get(config.capacidade).push(posicao);

        });

        const indicadoresHtml = [...capacidades.entries()].map(([nome, lista])=>{

            const media = lista.reduce((s,p)=>s+p,0) / lista.length;

            const faixa = classificarSafeScore(media);

            const cor = faixa?.cor || "#94a3b8";

            const emoji = faixa?.emoji || "";

            return `

                <div style="margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:4px;">
                        <strong>${nome}</strong>
                        <span style="color:${cor}">${emoji} ${Math.round(media)}</span>
                    </div>
                    <div class="barra-evolucao-trilha"><div style="width:${media}%; background:${cor};"></div></div>
                </div>

            `;

        }).join("") || `<p style="color:#94a3b8">Faça sua primeira avaliação pra ver os indicadores aqui.</p>`;

        document.getElementById("indicadoresCapacidadeAluno").innerHTML = indicadoresHtml;

    }catch(erro){

        console.error("Erro ao montar os indicadores por capacidade:", erro);

        document.getElementById("indicadoresCapacidadeAluno").innerHTML = `<p style="color:#DC2626">Não foi possível carregar os indicadores agora.</p>`;

    }

    // ---- MEDALHAS ----
    try{

        const melhorouAlgumTeste = Object.entries(TESTES_CONFIG).some(([chave, config])=>{

            const registros = statusPorTeste[chave].registros;

            if(registros.length < 2){
                return false;
            }

            const posAtual = calcularPosicao(config, registros[0]);

            const posAnterior = calcularPosicao(config, registros[1]);

            return posAtual !== null && posAnterior !== null && posAtual > posAnterior;

        });

        const medalhas = [

            { condicao: totalRegistros >= 1, emoji:"🏅", texto:"Primeira Avaliação" },
            { condicao: totalRegistros >= 5, emoji:"🥈", texto:"Cinco avaliações concluídas" },
            { condicao: melhorouAlgumTeste, emoji:"🥉", texto:"Melhorou em algum teste" },
            { condicao: testesFeitos >= totalDeTestes, emoji:"⭐", texto:"Todos os testes realizados" }

        ];

        document.getElementById("medalhasAluno").innerHTML = medalhas.map(m => `

            <div class="medalha-aluno ${m.condicao ? "" : "bloqueada"}">
                <div class="medalha-aluno-emoji">${m.emoji}</div>
                <div>${m.texto}</div>
            </div>

        `).join("");

    }catch(erro){

        console.error("Erro ao montar as medalhas:", erro);

    }

    // ---- LINHA DO TEMPO ----
    try{

        const linhaDoTempo = Object.entries(TESTES_CONFIG)

            .flatMap(([chave, config]) => statusPorTeste[chave].registros.map(r => ({ chave, config, registro: r })))

            .sort((a,b)=>{

                const dataA = a.registro.dataTeste ? a.registro.dataTeste.toMillis() : 0;

                const dataB = b.registro.dataTeste ? b.registro.dataTeste.toMillis() : 0;

                return dataB - dataA;

            })

            .slice(0, 15);

        document.getElementById("linhaDoTempoAluno").innerHTML = linhaDoTempo.map(({ chave, config, registro })=>{

            const data = registro.dataTeste ? registro.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

            const classificacao = registro[config.campoPosicao] || "";

            return `

                <div class="linha-historico-lateral">
                    <div class="linha-historico-lateral-data">${data} — ${config.titulo}</div>
                    <div class="linha-historico-lateral-classificacao">${classificacao}</div>
                </div>

            `;

        }).join("") || `<p style="color:#94a3b8">Nenhuma avaliação ainda.</p>`;

    }catch(erro){

        console.error("Erro ao montar a linha do tempo:", erro);

    }

    // ---- MEUS RESULTADOS DETALHADOS ----
    try{

        const secoesComDados = Object.entries(TESTES_CONFIG)

            .map(([chave, config]) => ({ chave, config, registros: statusPorTeste[chave].registros }))

            .filter(s => s.registros.length > 0);

        listaMeusResultados.innerHTML = secoesComDados.length > 0

            ? secoesComDados.map(renderizarSecaoResultado).join("")

            : "<p style='color:#94a3b8'>Você ainda não tem nenhuma avaliação registrada.</p>";

    }catch(erro){

        console.error("Erro ao montar meus resultados detalhados:", erro);

    }

}

function renderizarSecaoResultado({ chave, config, registros }){

    const cartoes = registros.map(registro=>{

        const data = registro.dataTeste ? registro.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

        const linhas = config.colunas.map(c => `

            <div class="linha-resultado">
                <span>${c.label}</span>
                <span>${registro[c.campo] ?? "-"}</span>
            </div>

        `).join("");

        return `

            <div class="resultado-teste">
                <div class="titulo-resultado">${data}</div>
                ${linhas}
            </div>

        `;

    }).join("");

    const iconeHtml = iconeTeste(chave, 28);

    return `

        <h4 style="display:flex; align-items:center; gap:8px;">
            ${iconeHtml}
            ${config.titulo}
        </h4>

        ${cartoes}

    `;

}