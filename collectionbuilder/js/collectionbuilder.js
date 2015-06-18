
$(function(){

	/************************** Events **************************/
	var dispatcher = _.clone(Backbone.Events)

	/************************** Models **************************/
	var LCCollection = Backbone.Model.extend({
		defaults: function() {
			return {
				title: "New collection"
			}
		}
	});

	var LCCollectionList = Backbone.Collection.extend({
		model: LCCollection,
		url: 'http://api.lib.harvard.edu/v2/collections',
	});

	var lcCollections = new LCCollectionList;


	/************************** Views **************************/
	var LCCollectionView = Backbone.View.extend({

		tagName : 'li',
		className : 'list-group-item',
		template : _.template("<a href='#<%= identifier %>'><%= title %></a"),

		events: {
			"click a" : "selectCollection",
		},

		initialize: function() {
			this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		selectCollection : function() {
			console.log("Selected collection");
			trigger()
		}

	})	

	var LCCollectionListView = new Backbone.CollectionView({
		  el : $( "ul#collection-list" ),
		  selectable : false,
		  collection : lcCollections,
		  modelView : LCCollectionView,

		  initialize: function() {
		  	lcCollections.fetch();
		  }
	} );

	/************************** Routes **************************/
	var Workspace = Backbone.Router.extend({

	  routes: {
	    "help":       	            "help",    // #help
	    "collection/:query":        "collection",  // #search/kiwis
	  },

	  help: function() {
	    console.log('help');
	  },

	  collection: function(query) {
	    console.log("collection" + query);
	  }

	});

	/************************** Initialization **************************/
	
	
	Backbone.history.start() 
  	lcCollections.fetch();
	LCCollectionListView.render();

});


