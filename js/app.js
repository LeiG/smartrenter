'use strict';

var map;

function viewModel() {
  var self = this;

  self.address = ko.observable("");
  self.ptrRatio = ko.observable(25);
  self.ptrRatioText = self.ptrRatio;

  self.updateAddress = function() {

    self.address(self.address());
  };

  var map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 37.558, lng: -122.271},
    scrollwheel: false,
    zoom: 17,
    mapTypeId: google.maps.MapTypeId.SATELLITE
  });
};

function initApp() {
  ko.applyBindings(new viewModel());
};
