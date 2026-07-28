// ======================================================
// SAFE
// Módulo: Dashboard
// ======================================================

import { db } from "../core/firebase.js";
import { souSuperAdmin, obterEscolaId } from "../core/utils.js";

import {
    collection,
    getDocs,
    query,
    where
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Uma entrada por teste, pra somar avaliações e montar as
// atividades recentes sem repetir a lista em cada função.
const TESTES_CONFIG = [
    { colecao:"avaliacoes_circunferenciacintura", titulo:"Perímetro da Cintura" },
    { colecao:"avaliacoes_leger", titulo:"Léger" },
    { colecao:"avaliacoes_imc", titulo:"IMC" },
    { colecao:"avaliacoes_flexibilidade", titulo:"Flexibilidade" },
    { colecao:"avaliacoes_abdominal", titulo:"Resistência Muscular" },
    { colecao:"avaliacoes_medicineball", titulo:"Potência Superior" },
    { colecao:"avaliacoes_saltohorizontal", titulo:"Potência Inferior" },
    { colecao:"avaliacoes_agilidade", titulo:"Agilidade" },
    { colecao:"avaliacoes_corrida20m", titulo:"Velocidade" },
    { colecao:"avaliacoes_corrida6min", titulo:"Apt. Cardiorrespiratória" }
];

export async function init(){

    await carregarDashboard();

}

// Monta a consulta já filtrada pela escola do usuário logado.
// super_admin não tem escolaId próprio, então vê tudo sem filtro.
function consultaDaEscola(nomeColecao){

    if(souSuperAdmin()){

        return collection(db, nomeColecao);

    }

    return query(

        collection(db, nomeColecao),

        where("escolaId", "==", obterEscolaId())

    );

}

async function carregarDashboard(){

    try{

        const turmas = await getDocs(consultaDaEscola("turmas"));

        const alunos = await getDocs(consultaDaEscola("alunos"));

        document.getElementById("cardTurmas").textContent = turmas.size;

        document.getElementById("cardAlunos").textContent = alunos.size;

        await Promise.all([

            carregarContagemAvaliacoes(),

            carregarContagemProfessores(),

            carregarUltimasAtividades()

        ]);

    }catch(erro){

        console.error(erro);

    }

}

// ======================================================
// TOTAL DE AVALIAÇÕES (soma as 9 coleções de teste)
// ======================================================

async function carregarContagemAvaliacoes(){

    try{

        const snapshots = await Promise.all(

            TESTES_CONFIG.map(config => getDocs(consultaDaEscola(config.colecao)))

        );

        const total = snapshots.reduce((soma, snap) => soma + snap.size, 0);

        document.getElementById("cardAvaliacoes").textContent = total;

    }catch(erro){

        console.error("Erro ao contar avaliações:", erro);

    }

}

// ======================================================
// TOTAL DE PROFESSORES (papel professor ou admin_escola)
// ======================================================

async function carregarContagemProfessores(){

    try{

        let snapshot;

        if(souSuperAdmin()){

            snapshot = await getDocs(collection(db,"usuarios"));

        }else{

            const q = query(

                collection(db,"usuarios"),

                where("escolaIds","array-contains",obterEscolaId())

            );

            snapshot = await getDocs(q);

        }

        let total = 0;

        snapshot.forEach(docSnap=>{

            const papel = docSnap.data().papel;

            if(papel === "professor" || papel === "admin_escola"){

                total++;

            }

        });

        document.getElementById("cardProfessores").textContent = total;

    }catch(erro){

        console.error("Erro ao contar professores:", erro);

    }

}

// ======================================================
// ÚLTIMAS ATIVIDADES (avaliações mais recentes, de
// qualquer um dos 9 testes, misturadas e ordenadas por data)
// ======================================================

async function carregarUltimasAtividades(){

    const elemento = document.getElementById("ultimasAtividades");

    try{

        const snapshots = await Promise.all(

            TESTES_CONFIG.map(config => getDocs(consultaDaEscola(config.colecao)))

        );

        const registros = [];

        snapshots.forEach((snapshot, indice)=>{

            const titulo = TESTES_CONFIG[indice].titulo;

            snapshot.forEach(docSnap=>{

                const dados = docSnap.data();

                registros.push({

                    nome: dados.nome || "Aluno",
                    titulo,
                    dataTeste: dados.dataTeste ? dados.dataTeste.toMillis() : 0,
                    origem: dados.origem === "aluno" ? "autopreenchido pelo aluno" : "registrado pelo professor"

                });

            });

        });

        registros.sort((a,b) => b.dataTeste - a.dataTeste);

        const recentes = registros.slice(0, 10);

        if(recentes.length === 0){

            elemento.innerHTML = "Nenhuma atividade registrada ainda.";

            return;

        }

        elemento.innerHTML = recentes.map(r => {

            const data = r.dataTeste

                ? new Date(r.dataTeste).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })

                : "-";

            return `

                <div style="padding:8px 0; border-bottom:1px solid var(--borda,#E2E8F0); font-size:14px;">
                    <strong>${r.nome}</strong> fez o teste de <strong>${r.titulo}</strong>
                    <span style="color:#94a3b8"> — ${data} (${r.origem})</span>
                </div>

            `;

        }).join("");

    }catch(erro){

        console.error("Erro ao carregar últimas atividades:", erro);

        elemento.innerHTML = "Não foi possível carregar as atividades recentes.";

    }

}