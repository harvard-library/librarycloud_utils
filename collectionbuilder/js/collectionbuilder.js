
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

	/* Notify the search results to run a search */
	dispatcher.on("search:run", function(e) { 
					lcSearchResultItems.setQuery(e.query);
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
				title: "Item loading",
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

	var LCItemSearchResultsList = Backbone.Collection.extend({
		model: LCItem,
		url: function() { 
			return 'http://api.lib.harvard.edu/v2/items.dc?q=' 
						+ this.query 
						+ (this.query_start ? "&start=" + this.query_start : "");
		},

		parse: function (response, options) {
			this.attributes || (this.attributes = {});
			console.log(response);
			this.attributes.count = response.pagination.numFound;
			this.attributes.limit = response.pagination.limit;
			this.attributes.start = response.pagination.start;
			return (response.items != null) ? response.items.dc : [];
		},

		setQuery : function(query) {
			this.query = query;
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

		initialize: function(options) {
			options || (options = {});
			this.collection_id = options.collection_id;
			this.item = new LCItem({id: this.id});
			this.listenTo(this.item, "change", this.updateCollectionItem);
		},

		updateCollectionItem : function() {
			this.set({title : this.item.get("title")})	
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

	/* Display an item from the selected collection */
	var LCCollectionItemView = Backbone.View.extend({

		tagName : 'tr',
		template : _.template("<td><%= title %></td><td><%= item_id %></td><td>View Remove</td>"),

		events: {
			// "click a" : "selectCollection",
		},

		initialize: function() {
			this.listenTo(this.model, "change", this.render);
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

	/* Display the search form */
	var LCSearchFormView = Backbone.View.extend({
		el : $("#collection-add form.search-form"),
		template : _.template($('#collection-add form.search-form').html()),
		events: {
			"submit" : "search",
		},
		search : function(e) {
			dispatcher.trigger("search:run", {query: this.$el.find("input").val()});
		}
	});

	/* Display a single item in the search results */
	var LCSearchItemView = Backbone.View.extend({
		tagName : 'tr',
		template : _.template("<td><%= title %></td><td><%= identifier %></td><td>Add to collection</td>"),

		events: {
			// "click a" : "selectCollection",
		},

		initialize: function() {
			this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},
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

	var selectedCollection = new LCCollection({title : "Collection Detail View Goes Here"});	
	var titleView = new LCCollectionDetailTitleView({model:selectedCollection});
	titleView.render();

	var searchView = new LCSearchFormView();
	var searchPaginationView = new LCSearchItemListPaginationView({model: lcSearchResultItems});
	var searchResultCountView = new LCSearchItemListResultCountView({model: lcSearchResultItems});

});


