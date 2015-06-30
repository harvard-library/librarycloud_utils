
$(function(){

	/************************** Dispatch **************************/
	var dispatcher = _.clone(Backbone.Events)
	dispatcher.on("collection:select", function() { 
					lcCollectionItems.selectCollection(selectedCollection.attributes.identifier);
				});


	/************************** Models **************************/
	var LCCollection = Backbone.Model.extend({
		defaults: function() {
			return {
				title: "",
				identifier: "",
				abstract: "",
			}
		}
	});

	var LCCollectionList = Backbone.Collection.extend({
		model: LCCollection,
		url: 'http://api.lib.harvard.edu/v2/collections',
	});
	
	var LCCollectionItem = Backbone.Model.extend({
		defaults: function() {
			return { }
		}
	});

	var LCCollectionItemList = Backbone.Collection.extend({
		model: LCCollectionItem,
		url: function() { 
			return 'http://api.lib.harvard.edu/v2/collections/' + this.collection_id + '/items';				
		},
		initialize: function(options) {
			options || (options = {});
			this.collection_id = options.collection_id;
		},
		selectCollection : function(collection_id) {
			this.collection_id = collection_id;
			this.fetch({
				success: function(collection, response, options) {
					console.log(lcCollectionItems);
					LCCollectionItemListView.render();							
				}
			});
		},
	});


	var lcCollections = new LCCollectionList;
	var lcCollectionItems = new LCCollectionItemList;

	/************************** Views **************************/
	
	/* Display a single collection in the list and handle selecting a collection */
	var LCCollectionView = Backbone.View.extend({

		tagName : 'li',
		className : 'list-group-item',
		template : _.template("<a href='#<%= identifier %>'><%= title %></a"),

		events: {
			"click a" : "selectCollection",
		},

		initialize: function() {
			// this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		selectCollection : function() {
			selectedCollection.set({
				title: this.model.get("title"),
				abstract: this.model.get("abstract"),
				identifier: this.model.get("identifier"),
			});
			dispatcher.trigger("collection:select");
		}

	});	

	/* Display a list of collections */
	var LCCollectionListView = new Backbone.CollectionView({
		  el : $( "ul#collection-list" ),
		  selectable : false,
		  collection : lcCollections,
		  modelView : LCCollectionView,
	} );

	/* Display collection summary information */
	var LCCollectionDetailTitleView =  Backbone.View.extend({
	  	el : $( "#collection-detail" ),
		template : _.template('\
<div class="panel-heading">\
	<h3 class="panel-title" id="collection-title"><%= title %> <small><%= identifier %></small></h3>\
</div>\
<div id="sections-document" class="panel-body">\
	<strong>Abstract:</strong> <%= abstract %> \
	<p/><p>\
	<button type="button" class="btn btn-default btn-xs">Edit</button> <button type="button" class="btn btn-default btn-xs">Add Items</button>\
	</p>\
</div>\
'),

		initialize : function() {
		    this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

	});

	/* Display an item from the selected collection */
	var LCCollectionItemView = Backbone.View.extend({

		tagName : 'tr',
		template : _.template("<td>Name</td><td><%= item_id %></td><td>View Remove</td>"),

		events: {
			// "click a" : "selectCollection",
		},

		initialize: function() {
			// this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},
	});	


	/* Display the list of items from the selected collection */
	var LCCollectionItemListView = new Backbone.CollectionView({
		  el : $( "table#item-list" ),
		  selectable : false,
		  collection : lcCollectionItems,
		  modelView : LCCollectionItemView,
	} );



	/************************** Initialization **************************/
	
	
	Backbone.history.start() 
  	lcCollections.fetch();
	LCCollectionListView.render();
 //  	lcCollectionItems.fetch();
	// LCCollectionItemListView.render();

	var selectedCollection = new LCCollection({title : "Collection Detail View Goes Here"});
	
	var titleView = new LCCollectionDetailTitleView({model:selectedCollection});
	titleView.render();

});


