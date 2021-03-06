

  (function() {

    /*
      - Docs better
      - Comment code
    */


    var NYCRestaurants = Backbone.View.extend({

      el: $("body"),

      options: {
        cdn_url: "http://d2c5ry9dy1ewvi.cloudfront.net",
        user_name: "viz2",
        extra_params:{v:6},
        table_name: "restaurant_week",
        map_id: "map",
        cuisine_query: "SELECT DISTINCT cuisine FROM restaurant_week",
        restaurants_query: "SELECT *,ST_X(the_geom) as lng, ST_Y(the_geom) as lat FROM {{table_name}}",
        interactivity: "cartodb_id,name,meal,cuisine,price,link,lat,lng",
        tile_style: "",
        lat: 40.723713744687274,
        lng: -73.97566795349121,
        zoom: 14,
        tooltip_template: "<h3><%= cuisine %></h3><h2><%= name %></h2><p><%= meal %></p><span class='cash' style='width:<%= price.length * 9 %>px'></span><span class='arrow'></span>"
      },

      events: {
        "click ul > li > a.type":  "_setFilter"
      },


      initialize: function() {

        _.bindAll(this,"_featureOver", "_featureOut", "_showTooltip");

        this.$filters = this.$el.find("#filters");
        this.$tooltip = this.$el.find("#tooltip");

        this._initMap();
        this._initLayer();
        this._initCuisines();
        this.filters = [];
      },

      render: function() {
        
      },      


      _initMap: function() {
        var map = this.map = new L.Map(this.options.map_id).setView(new L.LatLng(this.options.lat, this.options.lng), this.options.zoom)
          , mapboxUrl = 'http://{s}.tiles.mapbox.com/v3/cartodb.map-u6vat89l/{z}/{x}/{y}.png'
          , mapboxLayer = new L.TileLayer(mapboxUrl, { maxZoom: 20, attribution: '' });

        map.addLayer(mapboxLayer);

        this.$el.find("div.leaflet-control-attribution").html("Map tiles by <a href='www.openstreetmap.org/' target='_blank'>OSM</a> and <a href='http://mapbox.com/about/maps/' target='_blank'>Mapbox</a>");
      },


      _initLayer: function() {
        var layer = this.layer = new L.CartoDBLayer({
          map: this.map,
          cdn_url: this.options.cdn_url,
          user_name: this.options.user_name,
          table_name: this.options.table_name,
          query: this.options.restaurants_query,
          interactivity: this.options.interactivity,
          featureOver: this._featureOver,
          featureOut: this._featureOut,
          featureClick: this._featureClick,
          auto_bound: false
        });

        this.hoverCircle = new L.CircleMarker(new L.LatLng(-180,-180), {weight:2, fillColor: "red", fillOpacity: 1, clickable: false, opacity: 1, stroke: true, color:"#333333"});

        this.map.addLayer(layer)
      },


      _initCuisines: function() {
        var self = this;

        $.ajax({
          type: "GET",
          url: "http://" + this.options.user_name + ".cartodb.com/api/v2/sql?q=" + this.options.cuisine_query,
          dataType: "jsonp",
          success: function(r) {
            var cuisines = self.cuisines = _.map(r.rows, function(type){ return type.cuisine.replace(/\n/g, "").replace(/\r/g, "").replace(/\t/g, "") });

            // Put filters in the list
            self.$filters.append("<li><a class='type selected' href='#all'>All types</a></li>");
            _.each(cuisines, function(type,i) {
              self.$filters.append("<li><a class='type' href='#" + type + "'>" + type + "</a></li>")
            });

            // Scrollpane... oh no!
            self.$filters.parent().jScrollPane({
              showArrows: true,
              verticalArrowPositions: 'split',
              autoReinitialise: true
            });
          }
        })
      },

      _updateLayer: function() {

        var query = this.options.restaurants_query;

        if (_.size(this.filters) > 0) {
          query += " WHERE ";
          _.each(this.filters, function(cuisine,i) {
            query += " cuisine ILIKE '%" + cuisine + "%' OR ";
          });

          query = query.substring(0, query.length-3);
        }
        
        this.layer.setQuery(query);
      },


      // Library events
      _featureOver: function(ev,latlng,pos,data) {
        document.body.style.cursor = "pointer";

        this._showTooltip(data);
      },
      _featureOut: function() {
        document.body.style.cursor = "default";

        this._hideTooltip();
      },
      _featureClick: function(ev,latlng,pos,data) {
        window.open(data.link,'_blank','toolbar=1,location=1,directories=1,status=1,menubar=1,scrollbars=1,resizable=1'); 
      },
      _showTooltip: function(data) {

        var latlng = new L.LatLng(data.lat,data.lng)
          , position = this.map.layerPointToContainerPoint(this.map.latLngToLayerPoint(latlng));


        // Fake hover
        this.hoverCircle.setLatLng(latlng);

        switch (data.price) {
          case "$$": color="#FAEC1F"; break;
          case "$$$": color="#EAA226"; break;
          case "$$$$": color="#DB592E"; break;
          case "$$$$$": color="#CB0F35"; break;
          default: color = "white";
        }

        this.hoverCircle.setStyle({fillColor: color});
        this.hoverCircle.setRadius(6.4);
        this.map.addLayer(this.hoverCircle);

        this.$tooltip
          .html(_.template(this.options.tooltip_template,data));

        var h = this.$tooltip.outerHeight()
          , w = this.$tooltip.outerWidth();

        this.$tooltip.css({
          top: (position.y - h - 20) + "px",
          left: (position.x - (w/2) - 5) + "px"
        })
        .show();
      },
      _hideTooltip: function() {
        this.map.removeLayer(this.hoverCircle);
        this.$tooltip.hide();
      },


      // Aside events
      _setFilter: function(ev) {
        ev.preventDefault();

        var $cuisine = $(ev.target)
          , cuisine = $cuisine.text();

        // Check if selected
        if (_.include(this.filters,cuisine)) {
          return false;
        } else {
          var self = this;

          // Check if it is all types
          if (cuisine == "All types") {

            if (_.size(this.filters) == 0) return true;

            self.$filters.find("a.type:contains('All types')").addClass("selected");

            _.each(this.filters, function(type) {
              self.$filters.find("a.type:contains(" + type + ")").removeClass("selected");
            })

            this.filters = [];
          } else {
            $cuisine.addClass("selected");
            
            self.$filters.find("a.type:contains('All types')").removeClass("selected");

            _.each(this.filters, function(type) {
              self.$filters.find("a.type:contains(" + type + ")").removeClass("selected");
            })

            this.filters = [];

            this.filters.push(cuisine);
          }
        }

        // Change filter
        this._updateLayer();
      }
    });

    var app = new NYCRestaurants();
  })()