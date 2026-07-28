// ======================================================
// SAFE
// Módulo: Configurações
// Documento único: configuracoes/geral
// Só super_admin edita (a regra do Firestore já garante
// isso — aqui só escondemos o botão pra quem não pode usar)
// ======================================================

import { db } from "../core/firebase.js";

import { souSuperAdmin, mostrarToast } from "../core/utils.js";

import{
    doc,
    getDoc,
    setDoc
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let nomeSistemaConfig, anoLetivoConfig, btnSalvarConfig, loader;

function obterElementos(){

    nomeSistemaConfig = document.getElementById("nomeSistemaConfig");
    anoLetivoConfig = document.getElementById("anoLetivoConfig");
    btnSalvarConfig = document.getElementById("btnSalvarConfig");
    loader = document.getElementById("loader");

}

export async function init(){

    obterElementos();

    if(!souSuperAdmin()){

        nomeSistemaConfig.disabled = true;
        anoLetivoConfig.disabled = true;
        btnSalvarConfig.style.display = "none";

    }else{

        btnSalvarConfig.addEventListener("click", salvar);

    }

    await carregar();

}

async function carregar(){

    abrirLoader();

    try{

        const snap = await getDoc(doc(db,"configuracoes","geral"));

        if(snap.exists()){

            const dados = snap.data();

            nomeSistemaConfig.value = dados.nomeSistema || "SAFE - Sistema de Avaliação Física Escolar";

            anoLetivoConfig.value = dados.anoLetivoAtual || new Date().getFullYear();

        }else{

            nomeSistemaConfig.value = "SAFE - Sistema de Avaliação Física Escolar";

            anoLetivoConfig.value = new Date().getFullYear();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as configurações.", "erro");

    }finally{

        fecharLoader();

    }

}

async function salvar(){

    if(!anoLetivoConfig.value){

        mostrarToast("Informe o ano letivo.", "erro");

        return;

    }

    abrirLoader();

    btnSalvarConfig.disabled = true;

    try{

        await setDoc(doc(db,"configuracoes","geral"), {

            nomeSistema: nomeSistemaConfig.value.trim(),

            anoLetivoAtual: Number(anoLetivoConfig.value)

        }, { merge: true });

        mostrarToast("Configurações salvas com sucesso!");

    }catch(e){

        console.error(e);

        mostrarToast("Erro ao salvar configurações.", "erro");

    }finally{

        btnSalvarConfig.disabled = false;

        fecharLoader();

    }

}

function abrirLoader(){

    if(loader) loader.style.display = "flex";

}

function fecharLoader(){

    if(loader) loader.style.display = "none";

}