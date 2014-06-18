var ui = {
  "signin-block-visibility": $('#signin-block').is(':visible')
};

$('#guest').on('click', function(e) {
  e.preventDefault();
  document.location = $(this).attr("href");
});

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

$('.rules-btn').on('click', function(e) {
  e.preventDefault();
  ui["signin-block-visibility"] = $('#signin-block').is(':visible');
  $('#rules-block').show();
  $('#home-btns').hide();
  $('#guest-block').hide();
  $('#signin-block').hide();
  $('#logo-img').hide();
});

$('#back-btn').on('click', function(e) {
  e.preventDefault();
  $('#rules-block').hide();
  $('#home-btns').show();
  $('#guest-block').show();
  if (ui["signin-block-visibility"]) {
    $('#signin-block').show();
  } else {
    $('#logo-img').show();
  }
});

