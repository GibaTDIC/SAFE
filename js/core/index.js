const modal = document.getElementById("modalPorQueAvaliamos");
const audio = document.getElementById("audioPorQueAvaliamos");
const btnAbrir = document.getElementById("btnPorQueAvaliamos");
const btnFechar = document.getElementById("btnFecharPorQueAvaliamos");

function fecharModal(){

    modal.classList.remove("show");

    audio.pause();

}

btnAbrir.addEventListener("click", ()=>{

    modal.classList.add("show");

});

btnFechar.addEventListener("click", fecharModal);

modal.addEventListener("click", (evento)=>{

    if(evento.target === modal){

        fecharModal();

    }

});
