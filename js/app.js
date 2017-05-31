'use strict';

const zws_id = "X1-ZWz196h1g1ceff_4eq90";

var geocoder, map;
var markers = [];

function viewModel() {
  var self = this;

  geocoder = new google.maps.Geocoder();

  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 37.558, lng: -122.271},
    scrollwheel: false,
    zoom: 17,
    mapTypeId: google.maps.MapTypeId.SATELLITE
  });

  self.address = ko.observable("");
  self.ptrRatio = ko.observable(25);
  self.ptrRatioText = self.ptrRatio;
  self.location = ko.observable();
  self.property = ko.observable();
  self.propertyList = ko.observable();

  self.updateAddress = function() {

    self.address(self.address());
    self.location(updateLocation(self.address()));
    getZillowSearchResults();
  };

  getZillowSearchResults("632 Matsonia Dr", "Foster City, CA 94404");
}

function getZillowSearchResults(address, zipcode, rentzestimate = true) {
  var xmlSource = [
    "http://www.zillow.com/webservice/GetSearchResults.htm",
    `?zws-id=${zws_id}`,
    `&address=${encodeURIComponent(address)}`,
    `&citystatezip=${encodeURIComponent(zipcode)}`,
    `&rentzestimate=${rentzestimate}`
  ].join("");

  var yqlURL = [
    "http://query.yahooapis.com/v1/public/yql",
    "?q=" + encodeURIComponent("select * from xml where url='" + xmlSource + "'"),
    "&format=xml&callback=?"
  ].join("");

  $.getJSON(yqlURL, function(data){
    var xmlContent = $(data.results[0]);
    console.log(xmlContent.find('zpid').text());
  });
}

function updateLocation(address) {
  geocoder.geocode( { 'address': address}, function(results, status) {
    if (status == 'OK') {
      setMarker(results[0].geometry.location);
      return results[0];
    } else {
      alert('Geocode was not successful for the following reason: ' + status);
      return null;
    }
  });
}

function addMarker(location) {
  var marker = new google.maps.Marker({
    map: map,
    position: location
  });
  markers.push(marker);
}

function setMapOnAll(map) {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

function setMarker(location) {

  // Clear all markers
  setMapOnAll(null);

  map.setCenter(location);
  addMarker(location);
}

function initApp() {
  ko.applyBindings(new viewModel());
}
