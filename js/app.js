'use strict';

const zws_id = "X1-ZWz196h1g1ceff_4eq90";
const minZoom = 17;

var geocoder, map, infowindow;
var markers = [];

function viewModel() {
  var self = this;

  geocoder = new google.maps.Geocoder();

  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 37.558, lng: -122.271},
    scrollwheel: false,
    zoom: minZoom,
    mapTypeId: google.maps.MapTypeId.SATELLITE
  });
  infowindow = new google.maps.InfoWindow();


  self.address = ko.observable("632 Matsonia Dr, Foster City, CA 94404");
  self.bedrooms = ko.observable(1);
  self.bedroomsText = self.bedrooms;
  self.bathrooms = ko.observable(1);
  self.bathroomsText = self.bathrooms;
  self.ptrRatio = ko.observable(25);
  self.ptrRatioText = self.ptrRatio;
  self.location = ko.observable({address: "632 Matsonia Dr", zipcode: "94404"});
  self.zpid = ko.observable();
  self.property = ko.observable();
  self.propertyList = ko.observableArray([]);

  self.updateAddress = function() {

    self.address(self.address());

    updateLocation(self.address(), self);
  };

  ko.computed(function() {
    var xmlSource = [
      "http://www.zillow.com/webservice/GetSearchResults.htm",
      `?zws-id=${zws_id}`,
      `&address=${encodeURIComponent(self.location().address)}`,
      `&citystatezip=${encodeURIComponent(self.location().zipcode)}`,
    ].join("");

    var yqlURL = [
      "http://query.yahooapis.com/v1/public/yql",
      "?q=" + encodeURIComponent("select * from xml where url='" + xmlSource + "'"),
      "&format=xml&callback=?"
    ].join("");

    return $.ajax({
      dataType: "json",
      url: yqlURL,
      success: function(data) {
        var xmlContent = $(data.results[0]);
        var zpid = xmlContent.find('zpid').text();
        if (zpid != "") {
          self.zpid(zpid);
        } else {
          // clear all markers
          setMapOnAll(null);
          alert(`Oops, we couldn't find a property on ${self.location().address}, ${self.location().zipcode} from Zillow...`);
        }
      }
    });
  }, self).extend({async: true});

  ko.computed(function() {
    var xmlSource = [
      "http://www.zillow.com/webservice/GetDeepComps.htm",
      `?zws-id=${zws_id}`,
      `&zpid=${self.zpid()}`,
      `&count=25`,
      `&rentzestimate=true`,
    ].join("");

    var yqlURL = [
      "http://query.yahooapis.com/v1/public/yql",
      "?q=" + encodeURIComponent("select * from xml where url='" + xmlSource + "'"),
      "&format=xml&callback=?"
    ].join("");

    return $.ajax({
      dataType: "json",
      url: yqlURL,
      success: function(data) {
        var xmlContent = $(data.results[0]);

        // principal property
        var principalXml = xmlContent.find('principal');
        var principalProperty = parseProperty(principalXml);

        if(principalProperty.zpid != "") setMarker(principalProperty);

        self.property(principalProperty);
        self.bedrooms(self.property().bedrooms);
        self.bathrooms(self.property().bathrooms);

        // comparable properties
        xmlContent.find('comp').each(function(i, v) {
          var tmpProperty = parseProperty($(v));
          self.propertyList.push(tmpProperty);
         });
      }
    });
  }, self).extend({async: true});

  self.showPropertyList = ko.computed(function() {
    var minPtrRatio = Number(self.ptrRatio());
    var numBedrooms = Number(self.bedrooms());
    var numBathrooms = Number(self.bathrooms());

    for (let i = 0; i < self.propertyList().length; i++) {
      var tmpProperty = self.propertyList()[i];

      if (tmpProperty.ptrRatio > minPtrRatio &&
          tmpProperty.bedrooms >= numBedrooms &&
          tmpProperty.bathrooms >= numBathrooms
         ) {
        addMarker(tmpProperty, false);
      } else {
        removeMarker(tmpProperty.address.location);
      }
    }
  }, self);
}

function parseProperty(xmlString) {
  var property = {
    zpid: xmlString.find('zpid').text(),
    address: {
      street: xmlString.find('street').text(),
      zipcode: xmlString.find('zipcode').text(),
      city: xmlString.find('city').text(),
      state: xmlString.find('state').text(),
      // {lat, lng}
      location: {
        lat: Number(xmlString.find('latitude').text()),
        lng: Number(xmlString.find('longitude').text())
      }
    },
    yearbuilt: xmlString.find('yearbuilt').text(),
    lotsizesqft: xmlString.find('lotsizesqft').text(),
    bathrooms: Number(xmlString.find('bathrooms').text()),
    bedrooms: Number(xmlString.find('bedrooms').text()),
    totalrooms: xmlString.find('totalrooms').text(),
    zestimate: xmlString.find('zestimate').find('amount').text(),
    rentzestimate: xmlString.find('rentzestimate').find('amount').text(),
    homedetails: xmlString.find('homedetails').text(),
    ptrRatio: Number(xmlString.find('zestimate').find('amount').text()) / (12 * xmlString.find('rentzestimate').find('amount').text())
  };

  return property;
}

function updateLocation(address, self) {
  geocoder.geocode({ 'address': address}, function(results, status) {
    if (status == 'OK') {
      // setMarker(results[0].geometry.location);
      var address_components = results[0].address_components;
      self.location({
        address: address_components[0].short_name + " " + address_components[1].short_name,
        zipcode: address_components[6].short_name
      });
    } else {
      alert('Geocode was not successful for the following reason: ' + status);
    }
  });
}

function removeMarker(location) {
  var tmpLatLng = new google.maps.LatLng(location);

  for (let i = 0; i < markers.length; i++) {
    if (markers[i].getPosition().equals(tmpLatLng)) {
      markers[i].setMap(null);
    }
  }
}

function addMarker(property, isPrincipalProperty = true) {

  var pinColor = (isPrincipalProperty ? "FE7569" : "FFC433");
  var pinImage = new google.maps.MarkerImage(
    "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + pinColor,
    new google.maps.Size(21, 34),
    new google.maps.Point(0,0),
    new google.maps.Point(10, 34)
  );
  var pinShadow = new google.maps.MarkerImage(
    "http://chart.apis.google.com/chart?chst=d_map_pin_shadow",
    new google.maps.Size(40, 37),
    new google.maps.Point(0, 0),
    new google.maps.Point(12, 35)
  );

  var contentString = '<div id="content">' +
        `<h4>${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zipcode}</h4>` +
        '<ul style="list-style: none; padding-left:0;">' +
        `<li><b>Total rooms</b>: ${property.totalrooms}</li>` +
        '<ul type="disc">' +
        `<li>bedrooms: ${property.bedrooms}</li>` +
        `<li>bathrooms: ${property.bathrooms}</li>` +
        '</ul>' +
        `<li><b>Lot square ft</b>: ${property.lotsizesqft}</li>` +
        `<li><b>Year built</b>: ${property.yearbuilt}</li>` +
        '<li><b>Estimate</b></li>' +
        '<ul type="disc">' +
        `<li>price: $ ${property.zestimate}</li>` +
        `<li>rent: $ ${property.rentzestimate}</li>` +
        `<li>price-to-rent ratio: ${property.ptrRatio.toFixed(2)}</li>` +
        '</ul>' +
        `<li><b>More details</b>: <a href="${property.homedetails}" target="_blank">check it out on Zillow...</a></li>` +
        '</ul>' +
        '</div>';

  var marker = new google.maps.Marker({
    map: map,
    position: property.address.location,
    icon: pinImage,
    shadow: pinShadow,
    buborek: contentString
  });

  //   var infowindow = new google.maps.InfoWindow({
  //   content: contentString
  // });

  google.maps.event.addListener(marker, 'click', function(){
    infowindow.setContent(this.buborek);
    infowindow.open(map,this);
  });

  // marker.addListener('click', function() {
  //   infowindow.open(map, marker);
  // });

  markers.push(marker);

  var bounds = new google.maps.LatLngBounds();
  for (let i = 0; i < markers.length; i++) {
    bounds.extend(markers[i].getPosition());
  }

  map.fitBounds(bounds);
  if (map.getZoom() > minZoom) map.setZoom(minZoom);
}

function setMapOnAll(map) {

  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

function setMarker(property) {

  // Clear all markers
  setMapOnAll(null);

  map.setCenter(property.address.location);
  addMarker(property);
}

function initApp() {
  ko.applyBindings(new viewModel());
}
