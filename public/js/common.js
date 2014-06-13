$('#signin-btn').on('click', function(e) {
  e.preventDefault();
  $('#home-btns').hide();
  $('#signin-block').show();
  $('#logo-img').hide();
});

$('#cancel-btn').on('click', function(e) {
  e.preventDefault();
  $('#home-btns').show();
  $('#signin-block').hide();
  $('#logo-img').show();
});