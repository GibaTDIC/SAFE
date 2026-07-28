// ======================================================
// SAFE
// Módulo: Ficha de Avaliação (impressão em branco)
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    mostrarToast
} from "../core/utils.js";

import { calcularIdade } from "./leger.js";

import{
    collection,
    getDocs,
    query,
    where
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let escolas = [];

let turmas = [];

let alunos = [];

let escolaFicha, turmaFicha, alunoFicha, btnGerarFichas, btnExportarPdfFicha, areaFichas;

function obterElementos(){

    escolaFicha = document.getElementById("escolaFicha");
    turmaFicha = document.getElementById("turmaFicha");
    alunoFicha = document.getElementById("alunoFicha");
    btnGerarFichas = document.getElementById("btnGerarFichas");
    btnExportarPdfFicha = document.getElementById("btnExportarPdfFicha");
    areaFichas = document.getElementById("areaFichas");

}

function configurarEventos(){

    escolaFicha.addEventListener("change", carregarTurmas);

    turmaFicha.addEventListener("change", carregarAlunos);

    btnGerarFichas.addEventListener("click", gerarFichas);

    btnExportarPdfFicha.addEventListener("click", () => window.print());

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

}

// ======================================================
// CARREGAR ESCOLAS / TURMAS / ALUNOS
// ======================================================

async function carregarEscolas(){

    escolas = [];

    escolaFicha.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaFicha.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            const escolaId = obterEscolaId();

            escolaFicha.innerHTML = `<option value="${escolaId}">Minha escola</option>`;

            escolaFicha.value = escolaId;

            escolaFicha.disabled = true;

            await carregarTurmas();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

async function carregarTurmas(){

    turmas = [];

    turmaFicha.innerHTML = `<option value="">Selecione...</option>`;

    alunoFicha.innerHTML = `<option value="">Todos os alunos da turma</option>`;

    areaFichas.innerHTML = "";

    btnExportarPdfFicha.style.display = "none";

    if(!escolaFicha.value){

        return;

    }

    try{

        const q = query(collection(db,"turmas"), where("escolaId","==",escolaFicha.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        turmas.forEach(turma=>{

            turmaFicha.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

async function carregarAlunos(){

    alunos = [];

    alunoFicha.innerHTML = `<option value="">Todos os alunos da turma</option>`;

    areaFichas.innerHTML = "";

    btnExportarPdfFicha.style.display = "none";

    if(!turmaFicha.value){

        return;

    }

    try{

        const q = query(collection(db,"alunos"), where("escolaId","==",escolaFicha.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turmaFicha.value){

                alunos.push(dadosAluno);

            }

        });

        alunos.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        alunos.forEach(aluno=>{

            alunoFicha.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os alunos.", "erro");

    }

}

// ======================================================
// GERAR FICHAS
// ======================================================

function gerarFichas(){

    if(!turmaFicha.value){

        mostrarToast("Selecione ao menos a turma.", "erro");

        return;

    }

    const turmaSelecionada = turmas.find(t => t.id === turmaFicha.value);

    const escolaSelecionada = escolas.find(e => e.id === escolaFicha.value) || {

        nome: escolaFicha.options[escolaFicha.selectedIndex]?.textContent || "-"

    };

    const alunosParaGerar = alunoFicha.value

        ? alunos.filter(a => a.id === alunoFicha.value)

        : alunos;

    if(alunosParaGerar.length === 0){

        mostrarToast("Nenhum aluno encontrado.", "erro");

        return;

    }

    areaFichas.innerHTML = alunosParaGerar

        .map(aluno => renderizarFicha(aluno, turmaSelecionada, escolaSelecionada))

        .join("");

    btnExportarPdfFicha.style.display = "inline-block";

}

function renderizarFicha(aluno, turma, escola){

    const idade = aluno.dataNascimento ? calcularIdade(aluno.dataNascimento) : "-";

    const [anoNasc, mesNasc, diaNasc] = (aluno.dataNascimento || "").split("-");

    const dataNascExibicao = aluno.dataNascimento ? `${diaNasc}/${mesNasc}/${anoNasc}` : "___/___/______";

    const marcarM = (aluno.sexo || "").toLowerCase().startsWith("m") ? "( X )" : "(   )";

    const marcarF = (aluno.sexo || "").toLowerCase().startsWith("f") ? "( X )" : "(   )";

    return `

        <div class="ficha-impressao">

            <div class="ficha-marca-canto">
                <img src="assets/logo-gibabit.png" alt="Gibabit" onerror="this.style.display='none'">
            </div>

            <div class="ficha-cabecalho-safe">
                <h2>SAFE</h2>
                <span>Sistema de Avaliação Física Escolar</span>
            </div>

            <table class="tabela-ficha">

                <tr>
                    <td><strong>ESCOLA:</strong> ${escola.nome || "-"}</td>
                    <td><strong>SÉRIE:</strong> ${turma?.serie || "-"}</td>
                    <td><strong>TURMA:</strong> ${turma?.nome || "-"}</td>
                </tr>

                <tr>
                    <td colspan="2"><strong>ENDEREÇO:</strong> ${escola.endereco || "-"}</td>
                    <td><strong>SAFE-ID:</strong> ${aluno.codigoSAFE || "-"}</td>
                </tr>

                <tr>
                    <td colspan="3"><strong>NOME COMPLETO DO ALUNO:</strong> ${aluno.nome || "-"}</td>
                </tr>

                <tr>
                    <td><strong>SEXO:</strong> ${marcarM} M &nbsp; ${marcarF} F</td>
                    <td colspan="2"><strong>DATA DE NASCIMENTO:</strong> ${dataNascExibicao} &nbsp; (${idade} anos)</td>
                </tr>

                <tr>
                    <td><strong>DATA DA AVALIAÇÃO:</strong> ___/___/______</td>
                    <td><strong>HORÁRIO:</strong> _______</td>
                    <td><strong>TEMPERATURA:</strong> _______</td>
                </tr>

                <tr>
                    <td colspan="3"><strong>Apresenta alguma deficiência?</strong> (   ) Não &nbsp; (   ) Sim — Qual? ${"_".repeat(30)}</td>
                </tr>

                <tr>
                    <td colspan="3" class="ficha-subtitulo">Testes Físicos</td>
                </tr>

                <tr>
                    <td>Massa corporal: _______ kg</td>
                    <td colspan="2">Léger — total de voltas: _______</td>
                </tr>

                <tr>
                    <td>Estatura: _______ cm</td>
                    <td colspan="2">Aptidão Cardiorrespiratória (6min): nº de voltas: ____ / total em m: _______</td>
                </tr>

                <tr>
                    <td>Envergadura: _______ cm</td>
                    <td colspan="2">Salto horizontal: _______ cm</td>
                </tr>

                <tr>
                    <td>Perímetro da cintura: _______ cm</td>
                    <td colspan="2">Arremesso de medicine ball (2kg): _______ cm</td>
                </tr>

                <tr>
                    <td>Sentar-e-alcançar (flexibilidade): _______ cm</td>
                    <td colspan="2">Quadrado de 4x4m (agilidade): _______ s</td>
                </tr>

                <tr>
                    <td>Abdominal (1min): _______ repetições</td>
                    <td colspan="2">Corrida de 20m (velocidade): _______ s</td>
                </tr>

                <tr>
                    <td colspan="3"><strong>Observações:</strong> ${"_".repeat(70)}</td>
                </tr>

            </table>

            <p class="ficha-referencia">

                GAYA, Anelise Reis. Projeto Esporte Brasil, PROESP-Br: Manual de medidas, testes e
                avaliações. / Anelise Reis Gaya, Adroaldo Gaya (coord.) — Porto Alegre: UFRGS/ESEFID,
                2021. 39 p.: il.

            </p>

        </div>

    `;

}