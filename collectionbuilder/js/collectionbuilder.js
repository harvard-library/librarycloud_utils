
$(function(){

	/************************** Dispatch **************************/
	var dispatcher = _.clone(Backbone.Events)

	/* Notify the list of collection items to update, since the selected collection has changed */
	dispatcher.on("collection:select", function(e) { 
					lcCollectionItems.selectCollection(e.collection_id);
					dispatcher.trigger("collection:refresh");
				});

	/* Delete a collection */
	dispatcher.on("collection:remove", function(e) { 
					lcCollections.remove(e.collection);
					selectedCollection = new LCCollection();
					lcCollectionItems.reset(null);	
					e.collection.destroy({headers: {'X-LibraryCloud-API-Key': '999999999'},
										  success: function() {
					  						dispatcher.trigger("collection:refresh");
										  }
										});
				});

	/* Refresh all views that display collections */
	dispatcher.on("collection:refresh", function(e) { 
					editCollectionView.undelegateEvents();
					editCollectionView = new LCCollectionEditView({model:selectedCollection});
					editCollectionView.render();
					titleView.undelegateEvents();
					titleView = new LCCollectionDetailTitleView({model:selectedCollection});
					titleView.render();
					LCCollectionListView.render();
					LCCollectionItemListView.render();					
				});

	/* Notify collection item list view to update, once the items for a collection have been loaded */
	dispatcher.on("collectionitems:refresh", function() { 
					LCCollectionItemListView.render();
				});

	/* Add a new collection */
	dispatcher.on("collection:add", function(e) { 
					lcCollections.addItem(e.title);
				});


	/* Download a list of collection item IDs */
	dispatcher.on("collection:download", function(e) { 
					var ids = _.pluck(lcCollectionItems.models,"id").join('\n');
					window.open("data:text/plain;charset=utf-8," + encodeURIComponent(ids));
				});


	/* Let's add an item to a collection! */
	dispatcher.on("collectionitems:add", function(e) { 
					lcCollectionItems.addItem(e.item);
					e.search_result_item.item.trigger("change", e.search_result_item.item);
				});

	/* Remove and item from a collection */
	dispatcher.on("collectionitems:remove", function(e) { 
					lcCollectionItems.removeItem(e.item);
				});

	/* View an item in a collection! */
	dispatcher.on("collectionitems:view", function(e) { 
					if (detailView) {
						detailView.undelegateEvents();						
					}
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
		},

		url: function() {
			return 'http://api.lib.harvard.edu/v2/collections/' + this.id;
		},

		idAttribute: "identifier",

		initialize: function(options) {
			// this.on("all", function(e,c){console.log(e);console.log(arguments);});
		},

	    sync: function(command, model, options) {
			/* Override the default sync behavior for adding collections.
			   Use POST instead of PUT. */
	    	if (command == "update" && !model.id) {
	    		command = "create";
	    		var t = this;
		    	options = _.extend(options, {
 											success:  function(data, textStatus, xhr) {
 													// Reset the list of collections. Due to
 													// CORS restrictions (I think) we can't
 													// get the ID of the collection we just 
 													// created from the 'Location' field, so 
 													// need to refresh all.
 													// TODO: Fix the CORS configuration 												
													t.collection.fetch({reset: true});
												}
											});

    		}
	    	options = _.extend(options, {
	    									headers: {'X-LibraryCloud-API-Key': '999999999'},
											dataFilter: function(data, type) {
											    if (type == "json" && data == "") {
	    								 		// Prevents throwing an error if we get a 
	    								 		// 201 response with empty string, which is
	    								 		// valid but causes jQuery to choke when
	    								 		// trying to parse the JSON response
											        data = null;
											    }
											    return data;
											},
	    								 });
	        return Backbone.sync.apply(this, arguments);
	    },

	});

	var LCCollectionList = Backbone.Collection.extend({
		model: LCCollection,
		url: 'http://api.lib.harvard.edu/v2/collections?limit=999',


		initialize: function(options) {
			// this.on("all", function(e,c){console.log(e);console.log(arguments);});
		},

		addItem : function(title) {
			var result = this.create({title: title});
		},
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
				title: "",
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
	    	options = _.extend(options, {
	    								  contentType: 'application/json'
	    								});
	    	if (command == "update") {
	    		command = "create";
		    	options = _.extend(options, {
		    								  data : JSON.stringify([{item_id: model.id}]),
		    								});
	    	} else if (command == "delete") {
		    	options = _.extend(options, {
		    								  url : this.url() + '/items/' + model.id,
		    								});
	    	}
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

		/* Add our API key when saving items to a collection */
		addItem : function(item) {
			var result = this.create({item_id: item.id}, {headers: {'X-LibraryCloud-API-Key': '999999999'}});
		},

		/* Add out API key when removing items from a collection */
		removeItem : function(item) {
			item.destroy({headers: {'X-LibraryCloud-API-Key': '999999999'}});
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
		template : _.template("<a href='#<%- identifier %>'><%- title %></a>"),

		events: {
			"click a" : "selectCollection",
		},

		initialize: function() {
			this.listenTo(this.model, "change", this.render);
			this.listenTo(this.model, "sync", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		selectCollection : function() {
			selectedCollection = this.model;
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

	var LCCollectionAddView = Backbone.View.extend({
		el : $("#add-collection-button"),

		events: {
			"click button" : "createCollection",
		},

		createCollection: function() {
			bootbox.prompt({
				title: "Choose a name for your collection", 
				callback: function(result) {                
						  if (result !== null) {                                             
							dispatcher.trigger("collection:add", {title: result});
						  }
						},
				animate: false,
			});
		}
	});

	/* Display collection summary information */
	var LCCollectionDetailTitleView =  Backbone.View.extend({
	  	el : $( "#collection-detail" ),
	  	template : _.template($('#t-collection-detail').html()),

		events: {
			"click button.delete" : "deleteCollection",
			"click button.download" : "downloadCollectionItems",
		},

		initialize : function() {
		    this.listenTo(this.model, "change", this.render);
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		deleteCollection: function() {
            bootbox.confirm({
            	message: "Are you sure you want to delete the collection \"" +
            				_.escape(this.model.get("title")) + "\"? This action cannot be undone.", 
            	callback: _.bind(function(result) {
			            		if (result) {
									dispatcher.trigger("collection:remove", { collection: this.model, });
			            		}
			            	}, this),
            	animate: false,
            	}
            );
		},

		downloadCollectionItems: function() {
			dispatcher.trigger("collection:download");
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
	var LCCollectionItemListRowView = Backbone.View.extend({

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
			dispatcher.trigger("collectionitems:view", {
				item: this.model,
			});
		},

		removeItem : function() {
			dispatcher.trigger("collectionitems:remove", {
								  item: this.model,
								});
		},


	});	


	/* Display the list of items from the selected collection */
	var LCCollectionItemListView = new Backbone.CollectionView({
		el : $( "table#item-list" ),
		selectable : false,
		collection : lcCollectionItems,
		modelView : LCCollectionItemListRowView,
	});

	/* Display the search form */
	var LCSearchFormView = Backbone.View.extend({
		el : $("#collection-add-item form.search-form"),
		template : _.template($('#collection-add-item form.search-form').html()),
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

	/* Edit collection name and abstract */
	var LCCollectionEditView = Backbone.View.extend({
		el : $("#edit-collection"),
		template : _.template($('#t-edit-collection').html()),
		initialize : function() {
		    this.listenTo(this.model, "change", this.render);
		},

		events : {
			"click .save" : "saveCollection",
		},

		render : function() {
			this.$el.html(this.template(this.model.attributes));
    		return this;
		},

		saveCollection: function() {
			this.model.set("title", this.$("#editCollectionName").val());
			this.model.set("abstract", this.$("#editCollectionAbstract").val());
			this.model.save();
			$(".modal").modal('hide');
		},
	});


	/************************** Initialization **************************/
	
	
	Backbone.history.start() 
  	lcCollections.fetch();
	LCCollectionListView.render();

	var selectedCollection = new LCCollection();	
	var titleView = new LCCollectionDetailTitleView({model:selectedCollection});
	titleView.render();
	var editCollectionView = new LCCollectionEditView({model:selectedCollection});
	editCollectionView.render();

	var searchView = new LCSearchFormView({model:selectedCollection});
	var searchPaginationView = new LCSearchItemListPaginationView({model: lcSearchResultItems});
	var searchResultCountView = new LCSearchItemListResultCountView({model: lcSearchResultItems});
	var addCollectionButtonView = new LCCollectionAddView();

});


