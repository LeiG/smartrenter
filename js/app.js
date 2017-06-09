'use strict';

const SETTINGS = {
  zws_id: "X1-ZWz196h1g1ceff_4eq90",
  minZoom: 17
};

var geocoder, map, infowindow;
var markers = [];

function viewModel() {
  var self = this;

  geocoder = new google.maps.Geocoder();
  infowindow = new google.maps.InfoWindow();

  // initialize map
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 37.558, lng: -122.271},
    scrollwheel: false,
    zoom: SETTINGS.minZoom,
    mapTypeId: google.maps.MapTypeId.SATELLITE
  });

  self.address = ko.observable("632 Matsonia Dr, Foster City, CA 94404");
  self.bedrooms = ko.observable(1);
  self.bathrooms = ko.observable(1);
  self.ptrRatio = ko.observable(10);
  self.location = ko.observable({address: "632 Matsonia Dr", zipcode: "94404"});
  self.zpid = ko.observable();
  self.property = ko.observable();
  self.propertyList = ko.observableArray([]);
  self.showPropertyList = ko.observableArray(self.propertyList());

  // update address when clicked go
  self.updateAddress = function() {

    var newAddress = $("#address-text").val();

    if (newAddress != self.address()) {
      self.address(newAddress);

      // clear all markers
      setMapOnAll(null);
      markers = [];

      updateLocation(self.address(), self);
    }
  };

  ko.computed(function() {
    var xmlSource = [
      "http://www.zillow.com/webservice/GetSearchResults.htm",
      `?zws-id=${SETTINGS.zws_id}`,
      `&address=${encodeURIComponent(self.location().address)}`,
      `&citystatezip=${encodeURIComponent(self.location().zipcode)}`,
    ].join("");

    // workaround "Access-Control-Allow-Origin" error
    // jsonp won't work here because of the returned value is XML
    var yqlURL = [
      "http://query.yahooapis.com/v1/public/yql",
      "?q=" + encodeURIComponent("select * from xml where url='" + xmlSource + "'"),
      "&format=xml&callback=?"
    ].join("");

    return $.ajax({
      dataType: "json",
      url: yqlURL
    }).done(function(data) {
      var xmlContent = $(data.results[0]);
      var zpid = xmlContent.find('zpid').text();
      if (zpid != "") {
        self.zpid(zpid);
      } else {
        // clear all markers
        setMapOnAll(null);
        alert(`Oops, we couldn't find a property on ${self.location().address}, ${self.location().zipcode} from Zillow...`);
      }
    }).fail(function(error) {
      setMapOnAll(null);
      alert('We hate to have you experience errors and we are working our ass off to fix it!');
    });
  }, self).extend({async: true});

  // update stored property list based on input address
  ko.computed(function() {
    var xmlSource = [
      "http://www.zillow.com/webservice/GetDeepComps.htm",
      `?zws-id=${SETTINGS.zws_id}`,
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
      url: yqlURL
    }).done(function(data) {
      var xmlContent = $(data.results[0]);

      // principal property
      var principalXml = xmlContent.find('principal');
      var principalProperty = parseProperty(principalXml);

      if(principalProperty.zpid != "") addMarker(principalProperty);

      self.property(principalProperty);

      // comparable properties
      xmlContent.find('comp').each(function(i, v) {
        var tmpProperty = parseProperty($(v));
        self.propertyList.push(tmpProperty);
        addMarker(tmpProperty, false);
      });
    }).fail(function(error) {
      setMapOnAll(null);
      alert('We hate to have you experience errors and we are working our ass off to fix it!');
    });
  }, self).extend({async: true});

  // update property list being displayed
  ko.computed(function() {
    var minPtrRatio = Number(self.ptrRatio());
    var numBedrooms = Number(self.bedrooms());
    var numBathrooms = Number(self.bathrooms());
    self.showPropertyList(self.propertyList());

    markers.forEach(function(markerProperty) {
      if (markerProperty[2] == false) {
        if (markerProperty[1].ptrRatio > minPtrRatio &&
            markerProperty[1].bedrooms >= numBedrooms &&
            markerProperty[1].bathrooms >= numBathrooms
           ) {
             markerProperty[0].setVisible(true);
             if (self.showPropertyList.indexOf(markerProperty[1]) === -1) {
               self.showPropertyList.push(markerProperty[1]);
             }
           } else {
             markerProperty[0].setVisible(false);
             self.showPropertyList.remove(markerProperty[1]);
           }
      }
    });
  }, self).extend({async: true});
}

// parse property data from Zillow api
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

function addMarker(property, isPrincipalProperty = true) {

  var pinShadow = new google.maps.MarkerImage(
    "http://chart.apis.google.com/chart?chst=d_map_pin_shadow",
    new google.maps.Size(40, 37),
    new google.maps.Point(0, 0),
    new google.maps.Point(12, 35)
  );
  var mapIcon = (
    isPrincipalProperty ?
      'https://www.google.com/mapfiles/marker.png' :
      'https://www.google.com/mapfiles/marker_yellow.png'
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
    icon: mapIcon,
    shadow: pinShadow,
    buborek: contentString
  });

  // only open one infowindow at a time
  google.maps.event.addListener(marker, 'click', function(){
    var icon = marker.getIcon();

    if (icon != 'https://www.google.com/mapfiles/marker.png') {
      marker.setIcon('https://www.google.com/mapfiles/marker_green.png');
    }

    infowindow.setContent(this.buborek);
    infowindow.open(map,this);
  });

  markers.push([marker, property, isPrincipalProperty]);

  // adjust zoom level based on the displayed markers
  var bounds = new google.maps.LatLngBounds();
  markers.forEach(function(markerProperty) {
    bounds.extend(markerProperty[0].getPosition());
  });

  map.fitBounds(bounds);
  if (map.getZoom() > SETTINGS.minZoom) map.setZoom(SETTINGS.minZoom);
}

function setMapOnAll(map) {

  markers.forEach(function(markerProperty) {
    markerProperty[0].setMap(map);
  });
}

function setMarker(property) {

  // Clear all markers
  setMapOnAll(null);

  map.setCenter(property.address.location);
  addMarker(property);
}

function errorApp() {
  alert('Google map API is not loaded correctly...');
}

function initApp() {
  ko.applyBindings(new viewModel());
}
