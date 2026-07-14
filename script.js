(function(){
  var header = document.getElementById('op-header');
  if(!header) return;
  function onScroll(){ header.classList.toggle('op-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll);
  onScroll();
})();
