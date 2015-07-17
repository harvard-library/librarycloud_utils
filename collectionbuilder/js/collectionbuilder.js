
$(function(){

	/************************** Dispatch **************************/
	var dispatcher = _.clone(Backbone.Events)

	/* Notify the list of collection items to update, since the selected collection has changed */
	dispatcher.on("collection:select", function(e) { 
					lcCollectionItems.selectCollection(e.collection_id);
				});

	/* Notify collection item list view to update, once the items for a collection have been loaded */
	dispatcher.on("collectionitems:refresh", function() { 
					LCCollectionItemListView.render();
				});

	/* Let's add an item to a collection! */
	dispatcher.on("collectionitems:add", function(e) { 
					lcCollectionItems.addItem(e.item);
					e.search_result_item.item.trigger("change", e.search_result_item.item);
				});

	/* View an item in a collection! */
	dispatcher.on("collectionitem:view", function(e) { 
					var detailView = new LCCollectionItemDetailView({model:new LCItem({id : e.item.id})});
					detailView.render();
				});

	/* Notify the search results to run a search */
	dispatcher.on("search:run", function(e) { 		
					lcSearchResultItems.setQuery(e.query);
					lcSearchResultItems.setActiveCollectionItems(e.collectionitems);
				});

	/* Notify the search results list to update, once the search has completed */
	dispatcher.on("search:refresh", function(e) { 
					LCSearchItemListView.render();
					searchPaginationView.render();
					searchResultCountView.render();
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
	
	var LCItem = Backbone.Model.extend({
		defaults: function() {
			return { 
				title: "",
				creator: "",
				contributor: "",
				type: "",
				publisher: "",
				language: "",
				format: "",
				description: "",
				subject: "",
				coverage: "",
				identifier: "",
			}
		},

		url: function() { 
			return 'http://api.lib.harvard.edu/v2/items/' + this.id + ".dc";
		},

		initialize: function(options) {
			options || (options = {});
			this.id = options.id;
			this.fetch();
		},

	});

	var LCSearchResultItem = Backbone.Model.extend({
		defaults: function() {
			return { 
				title: "",
				library_cloud_id: "",
				primary_title: "",
				secondary_title: "",
				in_collection: false,
			}
		},

		getLibraryCloudId : function(id) {
			var lcIdLine = _.find(_.flatten([id]),function(s) { return s.indexOf("librarycloud") != -1; });
			return lcIdLine.replace("librarycloud: ","");			
		},

		initialize: function(options) {
			this.item = new LCItem({id: this.getLibraryCloudId(this.get("identifier"))});
			this.listenTo(this.item, "change", this.updateSearchResultItem);
		},

		inCurrentCollection : function() {
			var id = this.item.id;
			var exists = false;
			if (this.collection) {
				exists = this.collection.active_collection_items.find(function(a) {
					return (a.item.id == id);
				});
			}
			return (exists != undefined);
		},

		updateSearchResultItem: function() {
			console.log("Updating item");
			this.set({
				library_cloud_id: this.item.id,
				primary_title: _.first(_.flatten([this.item.get("title")])),
				secondary_title: _.rest(_.flatten([this.item.get("title")])),
				in_collection: this.inCurrentCollection(),
			});
		}
	});

	var LCItemSearchResultsList = Backbone.Collection.extend({
		model: LCSearchResultItem,
		url: function() { 
			return 'http://api.lib.harvard.edu/v2/items.dc?q=' 
						+ this.query 
						+ (this.query_start ? "&start=" + this.query_start : "");
		},

		parse: function (response, options) {
			this.attributes || (this.attributes = {});
			this.attributes.count = response.pagination.numFound;
			this.attributes.limit = response.pagination.limit;
			this.attributes.start = response.pagination.start;
			return (response.items != null) ? response.items.dc : [];
		},

		/* Items from the collection currently being viewed */
		setActiveCollectionItems : function(collectionitems) {
			this.active_collection_items = collectionitems;
		},

		setQuery : function(query) {
			this.query = query;
			this.setPage(0);
			this.fetch({
				success: function(collection, response, options) {
					dispatcher.trigger("search:refresh");					
				}
			});
		},

		setPage : function(start) {
			this.query_start = start;
			this.fetch({
				success: function(collection, response, options) {
					dispatcher.trigger("search:refresh");					
				}
			});
		}
	})


	var LCCollectionItem = Backbone.Model.extend({
		defaults: function() {
			return { 
				title: "Loading",
				item: {},
			}
		},

		idAttribute: "item_id",

		url: function() { 
			return 'http://api.lib.harvard.edu/v2/collections/' + this.collection.collection_id;				
		},

		initialize: function(options) {
			options || (options = {});
			this.item = new LCItem({id: this.id});
			this.listenTo(this.item, "change", this.updateCollectionItem);
		},

		updateCollectionItem : function() {
			this.set({title : this.item.get("title")})	
		},

		/* We need to override the default sync behavior for adding items 
		   to a collection. Use POST instead of PUT, pass an array of 
		   dictionaries instead of a single dictionary, and exclude 
		   LCCollectionItem attributes other than the item_id */
	    sync: function(command, model, options) {
	    	if (command == "update") {
	    		command = "create";
	    	}
	    	options = _.extend(options, {
	    								  data : JSON.stringify([{item_id: model.id}]),
	    								  contentType: 'application/json'
	    								});
	        return Backbone.sync.apply(this, arguments);
	    },

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
					dispatcher.trigger("collectionitems:refresh");					
				}
			});
		},

		/* Add out API key when saving items to a collection */
		addItem : function(item) {
			this.create({item_id: item.id}, {headers: {'X-LibraryCloud-API-Key': '999999999'}});
		}

	});

	/* Define variables for the collection lists */
	var lcCollections = new LCCollectionList;
	var lcCollectionItems = new LCCollectionItemList;
	var lcSearchResultItems = new LCItemSearchResultsList;


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
			dispatcher.trigger("collection:select", {collection_id: this.model.get("identifier")});
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
	  	template : _.template($('#t-collection-detail').html()),

		initialize : function() {
		    this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},
	});

	/* Display collection summary information */
	var LCCollectionItemDetailView = Backbone.View.extend({
	  	el : $( "#view-item .modal-content" ),
	  	template : _.template($('#t-view-item').html()),

		initialize : function() {
		    this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},
	});


	/* Display an item from the selected collection */
	var LCCollectionItemListView = Backbone.View.extend({

		tagName : 'tr',
	  	template : _.template($('#t-collection-item').html()),

		events: {
			"click button.view" : "viewItem",
			"click button.remove" : "removeItem",
		},

		initialize: function() {
			this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		viewItem: function(e) {
			dispatcher.trigger("collectionitem:view", {
				item: this.model,
			});
		},

	});	


	/* Display the list of items from the selected collection */
	var LCCollectionItemListView = new Backbone.CollectionView({
		el : $( "table#item-list" ),
		selectable : false,
		collection : lcCollectionItems,
		modelView : LCCollectionItemListView,
	} );

	/* Display the search form */
	var LCSearchFormView = Backbone.View.extend({
		el : $("#collection-add form.search-form"),
		template : _.template($('#collection-add form.search-form').html()),
		events: {
			"submit" : "search",
		},
		search : function(e) {
			dispatcher.trigger("search:run", {
											  query: this.$el.find("input").val(),
											  collectionitems : lcCollectionItems,
											});
		}
	});

	/* Display a single item in the search results */
	var LCSearchItemView = Backbone.View.extend({
		tagName : 'tr',
		template : _.template($('#t-search-results-item').html()),

		events: {
			"click button" : "addItemToCollection",
		},

		initialize: function() {
			this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		addItemToCollection : function() {
			dispatcher.trigger("collectionitems:add", {
								  item: this.model.item,
								  collection : selectedCollection,
								  search_result_item: this.model,
								});
		}

	});

	/* Display the search results */
	var LCSearchItemListView = new Backbone.CollectionView({
		el : $( "table#search-results-list" ),
		selectable : false,
		collection : lcSearchResultItems,
		modelView : LCSearchItemView,
	} );

	/* Display the pagination for the search results */
	var LCSearchItemListPaginationView = Backbone.View.extend({
		el : $("#search-pagination"),
		template : _.template($('#t-search-pagination').html()),

		events: {
			"click .next" : "nextPage",
			"click .previous" : "previousPage",
		},

		previousPage : function() {
			if (this.show_previous()) {
				this.model.setPage(this.model.attributes.start - this.model.attributes.limit);
			}
		},
		
		nextPage : function() {
			if (this.show_next()) {
				this.model.setPage(this.model.attributes.start + this.model.attributes.limit);				
			}
		},

		show_previous : function() {
			return this.model.attributes.start > 0;
		},
		
		show_next : function() {
			return (this.model.attributes.start + this.model.attributes.limit) < this.model.attributes.count;
		},

		render : function() {
			var a = _.extend({
								show_previous: this.show_previous() ? "" : "disabled", 
								show_next: this.show_next() ? "" : "disabled"
							},
							this.model.attributes);
			this.$el.html(this.template(a));
    		return this;
		},
	});

	/* Display the number of results for the search results */
	var LCSearchItemListResultCountView = Backbone.View.extend({
		el : $("#search-results-count"),
		template : _.template($('#t-search-results-count').html()),
		render : function() {
			this.$el.html(this.template(_.extend(
				{
					page_end: Math.min(this.model.attributes.start + this.model.attributes.limit, this.model.attributes.count),
					page_start: Math.min(this.model.attributes.start + 1, this.model.attributes.count),
				}, 
				this.model.attributes)));
    		return this;
		},
	});


	/************************** Initialization **************************/
	
	
	Backbone.history.start() 
  	lcCollections.fetch();
	LCCollectionListView.render();

	var selectedCollection = new LCCollection();	
	var titleView = new LCCollectionDetailTitleView({model:selectedCollection});
	titleView.render();

	var searchView = new LCSearchFormView({model:selectedCollection});
	var searchPaginationView = new LCSearchItemListPaginationView({model: lcSearchResultItems});
	var searchResultCountView = new LCSearchItemListResultCountView({model: lcSearchResultItems});

});


