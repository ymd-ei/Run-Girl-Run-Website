(function () {
  var cards = document.querySelectorAll('.card');
  cards.forEach(function (card, index) {
    card.animate(
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 280,
        delay: 120 + index * 110,
        fill: 'both',
        easing: 'ease-out'
      }
    );
  });
})();
