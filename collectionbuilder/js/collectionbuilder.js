$(function () {

    var isDC = true;
    var collectionsUrlBase = config.collectionsUrlBase;
    var itemsUrlBase = config.itemsUrlBase;

    /************************** Dispatch **************************/
    var dispatcher = _.clone(Backbone.Events);

    /* API key updated. Update any views that check whether the API key is populated */
    dispatcher.on("apikey:updated", function (e) {
        //TODO: after the API Key is updated we need to refresh the collections list because permissions
        // may have changed
        lcCollections.fetch({
            success: function() {
                dispatcher.trigger("collection:refresh");
            }
        });
        addCollectionButtonView.render();
        titleView.render();
    });

    /* Error notifications */
    dispatcher.on("global:error", function (e) {
      bootbox.alert({
            title: "Error",
            message: "We've encountered an error" + (e.message ? ": " + e.message : "")
        });
    });


    /* Notify the list of collection items to update, since the selected collection has changed */
    dispatcher.on("collection:select", function (e) {
        selectedCollection = e;
        lcCollectionItems.selectCollection(e.get("systemId"));
        dispatcher.trigger("collection:refresh");
    });

    /* Delete a collection */
    dispatcher.on("collection:remove", function (e) {
        e.collection.destroy({
            wait: true,
            success: function () {
                lcCollections.remove(e.collection);
                selectedCollection = new LCCollection();
                lcCollectionItems.reset(null);
                dispatcher.trigger("collection:refresh");
            }
        });
    });

    /* Refresh all views that display collections */
    dispatcher.on("collection:refresh", function (e) {
        editCollectionView.undelegateEvents();
        editCollectionView = new LCCollectionEditView({ model: selectedCollection });
        editCollectionView.render();
        titleView.undelegateEvents();
        titleView = new LCCollectionDetailTitleView({ model: selectedCollection });
        titleView.render();
        uploadCollectionView.undelegateEvents();
        uploadCollectionView = new LCCollectionUploadView({ model: selectedCollection });
        uploadCollectionView.render();
        lcCollectionListView.render();
        lcCollectionItemListView.render();
    });

    /* Notify collection item list view to update, once the items for a collection have been loaded */
    dispatcher.on("collectionitems:refresh", function () {
      lcCollectionItemListView.render();
      pagerView.refresh();
    });

    /* Add a new collection */
    dispatcher.on("collection:add", function (e) {
        lcCollections.addItem(e.setName);
    });



    /* Download a list of collection item IDs */
    dispatcher.on("collection:download", function (e) {
        var downloadUrl = collectionsUrlBase + '/v2/collections/' + e.systemId + '/items_batch_download';
        window.location = downloadUrl;
    });


    /* Let's add an item to a collection! */
    dispatcher.on("collectionitems:add", function (e) {
        lcCollectionItems.addItem(e.item, function () {
          e.search_result_item.item.trigger("change", e.search_result_item.item);
          $("#item-list tr:last").addClass("added");

        });
    });

    /* Let's add an item to a collection! */
    dispatcher.on("collectionitems:upload", function (e) {
        _.each(e.ids, function (element, index, list) {
            var item = new LCItem({ id: element });
            lcCollectionItems.addItem(item);
        });
    });

    /* Remove and item from a collection */
    dispatcher.on("collectionitems:remove", function (e) {
        lcCollectionItems.removeItem(e.item);
    });

    /* View an item in a collection! */
    dispatcher.on("collectionitems:view", function (e) {
        if (detailView) {
            detailView.undelegateEvents();
        }
        var detailView = new LCCollectionItemDetailView({ model: new LCItem({ id: e.item.id }) });
        detailView.render();
    });

    /* Notify the search results to run a search */
    dispatcher.on("search:run", function (e) {
        lcSearchResultItems.setQuery(e.query);
        lcSearchResultItems.setActiveCollectionItems(e.collectionitems);
    });

    /* Notify the search results list to update, once the search has completed */
    dispatcher.on("search:refresh", function (e) {
        lcSearchItemListView.render();
        searchPaginationView.render();
        searchResultCountView.render();
    });

    /* Search for users */
    dispatcher.on("user:search", function (e) {
        lcUserSearchItems.setQuery(e.query);
    });

    /* Notify the user results list to update, once the search has completed */
    dispatcher.on("user:refresh", function (e) {
        LCUserSearchListView.render();
        //searchPaginationView.render();
        //searchResultCountView.render();
    });

    dispatcher.on("userpermissions:add", function (e) {
        lcPermissions.addUser(e.user, e.role, function () {
            lcPermissions.fetch();
            if (userSearchView.validate(false))
                userSearchView.search();
        });
    });

    dispatcher.on("userpermissions:remove", function (e) {
        lcPermissions.removeUser(e.user, function () {
            lcPermissions.fetch();
            if (userSearchView.validate(false))
                userSearchView.search();
        });

    });


    dispatcher.on("userpermissions:load", function (e) {
        lcUserSearchItems.reset();
        lcPermissions.selectCollection(e.collection_id);
    });

    dispatcher.on("userpermissions:refresh", function (e) {
        lcCollectionPermissionListView.render();
    });


    /************************** Models **************************/
    var LCCollection = Backbone.Model.extend({
        defaults: function () {
            return {
                setName: "",
                systemId: "",
                setDescription: "",
                setSpec: null,
                baseUrl: "",
                thumbnailUrn: "",
                collectionUrn: "",
                dcp: true,
                public: true,
                contactName: "",
                contactDepartment: ""
            }
        },

        url: function () {
            return collectionsUrlBase + '/v2/collections/' + this.id;
        },

        idAttribute: "systemId",

        initialize: function (options) {
            this.on("invalid", function () {
                dispatcher.trigger("global:error", { message: this.validationError });
            });
        },

        validate: function () {
            if (!this.get("setName")) {
                return "Set Name must not be empty";
            }
        },

        sync: function (command, model, options) {
            if (apiKey.get("key")) {
                options = _.extend(options, {
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") }
                });
            }
            /* Override the default sync behavior for adding collections.
         Use POST instead of PUT. */
            if (command == "update" && !model.id) {
                command = "create";
                var t = this;
                options = _.extend(options, {
                    success: function (data, textStatus, xhr) {
                        var location = xhr.getResponseHeader("Location");
                        t.collection.fetch({
                            reset: true,
                            success: function () {
                                if (location) {
                                    /* Get the new collection's ID, and select id */
                                    var c = location.split("/").pop()
                                    dispatcher.trigger("collection:select", t.collection.get(c));
                                }
                            }
                        });
                    }
                });

            }
            options = _.extend(options, {
                error: function (jqXHR, textStatus, errorThrown) {
                    var message = errorThrown;
                  if (statusCode == 401) {
                        message += " (Your API key may not be valid)"
                    }
                    dispatcher.trigger("global:error", { message: message });
                    dispatcher.trigger("collection:refresh");
                },
                headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") },
                dataFilter: function (data, type) {
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

        // isEditor and isOwner both have been changed to only return true. This is due to the Get Collections for User endpoint in Librarycloud not
        // attaching rights information to collections. However, since a user can now only get collections that they own, this should be ok.

        isEditor: function () {
            return true
            // return (this.attributes.accessRights && this.attributes.accessRights.role && this.attributes.accessRights.role.name == "editor")
                // || this.isOwner();
        },

        isOwner: function () {
            return true
            // return this.attributes.accessRights && this.attributes.accessRights.role && this.attributes.accessRights.role.name == "owner";

        }
    });

    var LCCollectionList = Backbone.Collection.extend({
        model: LCCollection,
        url: collectionsUrlBase + '/v2/collections/user',

        sync: function (command, model, options) {
            if (apiKey.get("key")) {
                options = _.extend(options, {
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") }
                });
            }
            return Backbone.sync.apply(this, arguments);
        },

        initialize: function (options) {
            // this.on("all", function(e,c){console.log(e);console.log(arguments);});
        },
        comparator: function(set) {
            return set.attributes.setName
        },

        addItem: function (setName) {
            var result = this.create({ setName: setName }, { wait: true });
        },
    });

    var LCItem = Backbone.Model.extend({
        defaults: function () {
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

        url: function () {
            return itemsUrlBase + '/v2/items/' + this.id + (isDC ? ".dc" : "");
        },

        getName: function (nameArray, matchingAttribute) {
            var match = null;
            if (nameArray) {
                if (nameArray.isArray) {
                    var matches = nameArray.filter(function (name) {
                        return name.role && name.role.roleTerm && name.role.roleTerm["#text"] == matchingAttribute;
                    });

                    var match = matches ? matches[0] : null;
                }
                else {
                    match = nameArray;
                }
            }

            if (match && match["namePart"])
                return match["namePart"];

            return "";
        },

        getGenre: function(genreArray) {
            return genreArray ? (genreArray.isArray ? genreArray[0]: genreArray)["#text"] : "";
        },

        getPropertyFromArray(array, property) {
            return array ? ((array.length > 1 ? array[0] : array)[property]) : "";
        },

        parse: function (response, options) {
            if (!isDC) {
                this.attributes || (this.attributes = {});
                this.attributes.title = this.getPropertyFromArray(response.titleInfo, "title");
                this.attributes.creator = this.getName(response.name, "creator");
                this.attributes.contributor = this.getName(response.name, "contributor");
                this.attributes.type = this.getPropertyFromArray(response.genre, "#text");
                this.attributes.publisher = response.originInfo.publisher;
                this.attributes.language = response.language ? this.getPropertyFromArray(response.language.languageTerm, "#text") : "";
                this.attributes.format = response.physicalDescription ? this.getPropertyFromArray(response.physicalDescription.form, "#text") : "" ;
                this.attributes.description = this.getPropertyFromArray(response.abstract, "#text");
                this.attributes.subject = response.subject ? response.subject.topic : "";
                this.attributes.coverage = response.subject ? response.subject.geographic : "";
                return this;
            }
            return response;
        },

        initialize: function (options) {
          options || (options = {});
          this.id = options.id;
          this.fetch({
            error: function(obj, response, opts) {
              obj.attributes.title = "Unknown object";
            }
          });
        },

    });

    var LCSearchResultItem = Backbone.Model.extend({
        defaults: function () {
            return {
                title: "",
                library_cloud_id: "",
                primary_title: "",
                secondary_title: "",
                in_collection: false,
            }
        },

        getLibraryCloudId: function (id) {
            var lcIdLine = _.find(_.without(_.flatten([id]), null), function (s) { return s.indexOf("librarycloud") != -1; });
            return lcIdLine.replace("librarycloud: ", "");
        },

        initialize: function (options) {
            if (isDC)
                this.item = new LCItem({ id: this.getLibraryCloudId(this.get("identifier")) });
            else
                this.item = new LCItem({ id: this.get("recordInfo").recordIdentifier["#text"] });
            this.listenTo(this.item, "change", this.updateSearchResultItem);
        },

        inCurrentCollection: function () {
            var id = this.item.id;
            var exists = false;
            if (this.collection) {
                exists = this.collection.active_collection_items.find(function (a) {
                    return (a.item.id == id);
                });
            }
            return (exists != undefined);
        },

        updateSearchResultItem: function () {
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
        url: function () {
            return itemsUrlBase + '/v2/items.dc?q='
            + this.query
            + (this.query_start ? "&start=" + this.query_start : "");
        },

        parse: function (response, options) {
            this.attributes || (this.attributes = {});
            this.attributes.count = response.pagination.numFound;
            this.attributes.limit = response.pagination.limit;
            this.attributes.start = response.pagination.start;
            return (response.items != null) ?
                (isDC ? response.items.dc : response.items.mods) : [];
        },

        /* Items from the collection currently being viewed */
        setActiveCollectionItems: function (collectionitems) {
            this.active_collection_items = collectionitems;
        },

        setQuery: function (query) {
            this.query = query;
            this.setPage(0);
        },

        setPage: function (start) {
            this.query_start = start;
            this.fetch({
                success: function (collection, response, options) {
                    dispatcher.trigger("search:refresh");
                }
            });
        }
    });

    var LCCollectionItem = Backbone.Model.extend({
        defaults: function () {
            return {
                title: "",
                item: {},
            }
        },

        idAttribute: "item_id",

        url: function () {
            return collectionsUrlBase + '/v2/collections/' + this.collection.collection_id;
        },

        initialize: function (options) {
            options || (options = {});
            this.item = new LCItem({ id: this.id });
            this.listenTo(this.item, "change", this.updateCollectionItem);
        },

        updateCollectionItem: function () {
            this.set({ setName: this.item.get("setName") })
        },

        /* We need to override the default sync behavior for adding items
       to a collection. Use POST instead of PUT, pass an array of
       dictionaries instead of a single dictionary, and exclude
       LCCollectionItem attributes other than the item_id */
        sync: function (command, model, options) {
            options = _.extend(options, {
                contentType: 'application/json',
                headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") },
                error: function (jqXHR, textStatus, errorThrown) {
                  var message = errorThrown;
                    if (statusCode = 401) {
                        message += " (Your API key may not be valid)"
                    }
                    dispatcher.trigger("global:error", { message: message });
                    dispatcher.trigger("collectionitems:refresh");
                },

            });
            if (command == "update") {
                command = "create";
                options = _.extend(options, {
                    data: JSON.stringify([{ item_id: model.id }]),
                });
            } else if (command == "delete") {
                options = _.extend(options, {
                    url: this.url() + '/items/' + model.id,
                });
            }
            return Backbone.sync.apply(this, arguments);
        },

    });

    var LCCollectionItemList = Backbone.PageableCollection.extend({
        model: LCCollectionItem,

        url: function () {
            return collectionsUrlBase + '/v2/collections/' + this.collection_id + '/items_paginated';
        },

        initialize: function (options) {
            options || (options = {});
            this.collection_id = options.collection_id;
        },

        parseRecords: function(resp, options) {
            return(resp.items);
        },

        parseState: function(resp, qp, state, opts) {
            if(resp.total_pages) {
                state.totalPages = resp.total_pages;
                state.lastPage = resp.total_pages;
            }
            return state;
        },

        selectCollection: function (collection_id) {
            this.collection_id = collection_id;
            this.fetch({
                success: function (collection, response, options) {
                    dispatcher.trigger("collectionitems:refresh");
                }
            });
        },

        addItem: function (item, done) {
            return (item.id && this.create({ item_id: item.id }, { wait: true, success: done }));
        },

        removeItem: function (item) {
          var that = this;
          item.destroy({
            wait: true,
            success: function() {
              that.fetch({
                success: function (collection, response, options) {
                  dispatcher.trigger("collectionitems:refresh");
                }
              });
            }
          });
        },

        state: {
          pageSize: 100,
          currentPage: 1
        },

        queryParams: {
            currentPage: "page",
            pageSize: "size",
        }
    });

    var LCUserPermission = Backbone.Model.extend({
        defaults: function () {
            return {
                name: "",
                role: "",
            }
        },

        sync: function (command, model, options) {
            if (apiKey.get("key")) {
                options = _.extend(options, {
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") }
                });
            }
            return Backbone.sync.apply(this, arguments);
        },

        initialize: function (options) {
            options || (options = {});
            this.id = options.id;
        },

    });

    var LCPermissionList = Backbone.Collection.extend({
        model: LCUserPermission,
        url: function () {
            return collectionsUrlBase + '/v2/collections/' + this.collection_id + '/user';
        },

        sync: function (command, model, options) {
            if (apiKey.get("key")) {
                options = _.extend(options, {
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") }
                });
            }
            return Backbone.sync.apply(this, arguments);
        },


        addUser: function (user, role, done) {
            return (this.create({ user:user, role: role }, { wait: true, success: done }));
        },

        removeUser: function (user, done) {
            user.attributes.id = user.attributes.user.id;
            user.destroy({ wait: true, success: done });
        },

        selectCollection: function (collection_id) {
            this.collection_id = collection_id;
            this.fetch({
                success: function (collection, response, options) {
                    dispatcher.trigger("userpermissions:refresh");
                }
            });
        },
    });

    var LCUser = Backbone.Model.extend({
        defaults: function () {
            return {
                name: "",
                email: ""
            }
        },

        initialize: function (options) {
            options || (options = {});
            this.id = options.id;
        },

        inCollection: function () {
            var email = this.attributes.email;
            var exists = false;
            if (lcPermissions) {
                exists = lcPermissions.find(function (a) {
                    return (a.attributes.user.email == email);
                });
            }
            return (exists != undefined);
        },

    });

    var LCUserSearchResultsList = Backbone.Collection.extend({
        model: LCUser,
        url: function () {
            return collectionsUrlBase + '/v2/users?q='
            + this.query;
        },
        sync: function (command, model, options) {
            if (apiKey.get("key")) {
                options = _.extend(options, {
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") }
                });
            }
            return Backbone.sync.apply(this, arguments);
        },

        validate: function (showError) {
            if (!this.query || !this.query.length > 2) {
                if (showError)
                    dispatcher.trigger("global:error", { message: "User search term must be at least 3 characters." });
                return false;
            }
            return true;
        },

        search: function () {
            this.fetch({
                success: function (collection, response, options) {
                    collection.reset(collection.filter(function (item) {
                        return !item.inCollection();
                    }));
                    dispatcher.trigger("user:refresh");
                }
            });
        },

        setQuery: function (query) {
            this.query = query;
            if (this.validate(true)) {
                this.search();
            }
        },

    });

    var LCRole = Backbone.Model.extend({
        defaults: function () {
            return {
                name: "",
                description: ""
            }
        },

        initialize: function (options) {
            options || (options = {});
            this.id = options.id;
        },

    });

    var LCRoleList = Backbone.Collection.extend({
        model: LCRole,
        url: function () {
            return collectionsUrlBase + '/v2/roles';
        },
        sync: function (command, model, options) {
            if (apiKey.get("key")) {
                options = _.extend(options, {
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") }
                });
            }
            return Backbone.sync.apply(this, arguments);
        },
    });


    var LCAPIKey = Backbone.Model.extend({
        defaults: function () {
            return {
                key: "",
            }
        },

        isKeySet: function () {
            return (this.get("key") ? true : false);
        },

        sync: function (method, model, options) {
            switch (method) {
                case "create":
                case "update":
                    localStorage.setItem("key", model.get("key"));
                    dispatcher.trigger("apikey:updated");
                    break;
                case "read":
                    model.set("key", localStorage.getItem("key"));
                    break;
                case "delete":
                    localStorage.removeItem("key");
                    dispatcher.trigger("apikey:updated");
                    break;
            }
        }

    });

    /* Define variables for the collection lists */
    var lcCollections = new LCCollectionList;
    var lcRoles = new LCRoleList;
    var lcCollectionItems = new LCCollectionItemList;
    var lcSearchResultItems = new LCItemSearchResultsList;
    var lcPermissions = new LCPermissionList;
    var lcUserSearchItems = new LCUserSearchResultsList;

    /************************** Views **************************/

    /**********************************************************

    COLLECTIONS MANAGEMENT

    ***********************************************************/

    /* Display a single collection in the list and handle selecting a collection */
    var LCCollectionView = Backbone.View.extend({

        tagName: 'li',
        className: 'list-group-item',
        template: _.template("<a href='#<%- systemId %>'><%- setName %></a>"),

        events: {
            "click a": "selectCollection",
        },

        initialize: function () {
            this.listenTo(this.model, "change", this.render);
            this.listenTo(this.model, "sync", this.render);
        },

        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

        selectCollection: function () {
            dispatcher.trigger("collection:select", this.model);
        }
    });

    var LCCollectionAddView = Backbone.View.extend({
        el: $("#add-collection-button"),
        template: _.template($('#t-collection-add').html()),

        events: {
            "click button": "createCollection",
        },

        render: function () {
            this.$el.html(this.template({ disabled: !apiKey.isKeySet() }));
            return this;
        },

        createCollection: function () {
            bootbox.prompt({
                title: "Choose a name for your set",
                callback: function (result) {
                    if (result !== null) {
                        dispatcher.trigger("collection:add", { setName: result });
                    }
                },
                animate: false,
            });
        }
    });

    /* Display collection summary information */
    var LCCollectionDetailTitleView = Backbone.View.extend({
        el: $("#collection-detail"),
        template: _.template($('#t-collection-detail').html()),

        events: {
            "click button.delete": "deleteCollection",
            "click button.download": "downloadCollectionItems",
            "click button.permissions": "loadPermissions",
        },

        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            this.$el.html(this.template(_.extend(this.model.attributes, { owner: this.model.isOwner(), editor: this.model.isEditor() })));
            return this;
        },

        deleteCollection: function () {
            bootbox.confirm({
                message: "Are you sure you want to delete the collection \"" +
                    _.escape(this.model.get("title")) + "\"? This action cannot be undone.",
                callback: _.bind(function (result) {
                    if (result) {
                        dispatcher.trigger("collection:remove", { collection: this.model, });
                    }
                }, this),
                animate: false,
            }
            );
        },

        downloadCollectionItems: function () {
            dispatcher.trigger("collection:download", {systemId: this.model.attributes.systemId});
        },

        loadPermissions: function () {
            dispatcher.trigger("userpermissions:load", { collection_id: this.model.id, });
        },

    });

    /* Display collection summary information */
    var LCCollectionItemDetailView = Backbone.View.extend({
        el: $("#view-item .modal-content"),
        template: _.template($('#t-view-item').html()),

        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },
    });

    /* Display an item from the selected collection */
    var LCCollectionItemListRowView = Backbone.View.extend({

        tagName: 'tr',
        template: _.template($('#t-collection-item').html()),

        events: {
            "click button.view": "viewItem",
            "click button.remove": "removeItem",
        },

        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            this.$el.html(this.template(_.extend(this.model.attributes, { editor: selectedCollection.isEditor() })));
              return this;
        },

        viewItem: function (e) {
            dispatcher.trigger("collectionitems:view", {
                item: this.model,
            });
        },

        removeItem: function () {
            dispatcher.trigger("collectionitems:remove", {
                item: this.model,
            });
        },
    });

    /* Edit collection name and abstract */
    var LCCollectionEditView = Backbone.View.extend({
        el: $("#edit-collection"),
        template: _.template($('#t-edit-collection').html()),
        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        events: {
            "click .save": "saveCollection",
        },

        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

        saveCollection: function () {
            this.model.set({
                setName: this.$("#editSetName").val(),
                setSpec: this.$("#editSetSpec").val(),
                setDescription: this.$("#editSetDescription").val(),
                dcp: this.$("#editDcp").is(":checked"),
                public: this.$("#editPublic").is(":checked"),
                baseUrl: this.$("#editBaseUrl").val(),
                thumbnailUrn: this.$("#editThumbnailUrn").val(),
                collectionUrn: this.$("#editCollectionUrn").val(),
                contactName: this.$("#editContactName").val(),
                contactDepartment: this.$("#editContactDepartment").val()
            });
            this.model.save({ wait: true });
            $(".modal").modal('hide');
        },
    });

    var LCCollectionItemListViewPager = Backbone.View.extend({
        el: $("#collection-item-pager"),
        events: {
            "click .prev": "previousPage",
            "click .next": "nextPage",
            "click .pagination .page-item": "getPage"
        },

        pageButtonTemplate: _.template('<li class="page-item page-<%= pageNumber %>"><a class="page-link btn <%= disabled ? \"disabled\" : \"\" %>" href="#"><%= pageNumber %></a></li>'),

        getPage: function(e) {
            e.preventDefault();
            e.stopPropagation();
            var page = parseInt(e.target.innerHTML);
            var that = this;
            lcCollectionItems.getPage(page, {
                success: function() {
                    $("#item-list tr").removeClass("added");
                    that.refresh();
                }
            });

        },

        refresh: function() {
            $("#collection-item-pager ul").empty();

            for (var i=1; i < lcCollectionItems.state.totalPages+1; i++) {
                var disabled = (lcCollectionItems.state.currentPage == i);
                $("#collection-item-pager ul").append(this.pageButtonTemplate({pageNumber: i, disabled: disabled}));
            }
        }
    });

    /* Upload a batch file containing item ids and send it to the API */
    var LCBatchItemUploadView = Backbone.View.extend({
        el: $("#item-batch-upload"),
        events: {
            "click .save": "uploadBatchItemFile"
        },

        uploadBatchItemFile: function(e) {
            var setId = selectedCollection.attributes.systemId;
            var file = $("#item-batch-file")[0].files[0];
            if (file != undefined) {
                $("#item-batch-upload button").addClass("disabled")

                var requestResultStatus;
                var requestSentNotification = $.notify({
                    title: 'Batch Item Request Sent',
                    message: 'Please do not refresh your browser or upload another batch until the request completes.'
                },{
                    type: 'info',
                    delay: 0,
                    onClosed: function() {
                        $.notify({
                            title: 'Batch Item Request Complete',
                            message: 'The server responded with status: '+requestResultStatus
                        },{
                            type: 'success'
                        });
                    }
                });

                $("#item-batch-upload").modal('hide');

                var data = new FormData();
                data.append("file", file);
                $.ajax({
                    url: collectionsUrlBase + "/v2/collections/" + setId + "/items_batch_upload",
                    headers: { 'X-LibraryCloud-API-Key': apiKey.get("key") },
                    data: data,
                    timeout: 0,
                    cache: false,
                    contentType: false,
                    processData: false,
                    method: 'POST',
                    type: 'POST', // For jQuery < 1.9
                    success: function(data, status){
                        if (status == 'success') {
                          // refresh the item list view
                          lcCollectionItems.fetch({
                            success: function() {
                              dispatcher.trigger("collectionitems:refresh");
                            }
                          });
                        }
                        requestResultStatus = status;
                    },
                    error: function(obj, status, err) {
                        requestResultStatus = status + " " + err;
                    },
                    complete: function() {
                        requestSentNotification.close();
                        $("#item-batch-upload button").removeClass("disabled");
                    }
                });
            }
        }
    });

    /* Upload collection items */
    var LCCollectionUploadView = Backbone.View.extend({
        el: $("#upload-collection"),
        template: _.template($('#t-upload-collection').html()),
        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        events: {
            "click .save": "uploadCollectionItems",
            "click .cancel": "clearUpload",
            "change .upload-files": "uploadFiles",
        },

        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

        uploadCollectionItems: function () {
            if (this.$("#upload").val()) {
                var ids = this.$("#upload").val().split(/[\s,]+/);
                if (ids) {
                    dispatcher.trigger("collectionitems:upload", { ids: ids });
                }
            }
            this.clearUpload();
        },

        clearUpload: function() {
            this.$("#upload").val("");
            this.$("#files").val("");
            $(".modal").modal('hide');
        },

        uploadFiles: function (event) {
            var files = event.target.files;
            if (files) {
                for (var i = 0, f; f = files[i]; i++) {
                    try {
                        var textType = /text.*/;

                        if (f.type.match(textType)) {
                            var reader = new FileReader();
                            reader.onload = (function (file) {

                                //pull the existing ids, if any, and remove any empty rows
                                var existingids = $("#upload").val().split(/[\s,]+/).filter(function (item) {
                                    return (item);
                                });

                                var newids = reader.result.split(/[\s,]+/);

                                //add the new ids to the existing ones, ignoring duplicates and empty rows
                                existingids = existingids.concat(newids.filter(function (item) {
                                    return (existingids.indexOf(item) < 0) && (item);
                                }));

                                $("#upload").val(existingids.join('\r\n'));
                            });

                            reader.readAsText(f);
                        }
                    }
                    catch (e) {
                        //swallow the exception
                    }
                }
            }
        }
    });

    /**********************************************************

    ITEM SEARCH

    ***********************************************************/

    /* Display the search form */
    var LCSearchFormView = Backbone.View.extend({
        el: $("#collection-add-item form.search-form"),
        template: _.template($('#collection-add-item form.search-form').html()),
        events: {
            "submit": "search",
        },
        search: function (e) {
            dispatcher.trigger("search:run", {
                query: this.$el.find("input").val(),
                collectionitems: lcCollectionItems,
            });
        }
    });

    /* Display a single item in the search results */
    var LCSearchItemView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template($('#t-search-results-item').html()),

        events: {
            "click button": "addItemToCollection",
        },

        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

        addItemToCollection: function () {
            this.$el.find("button").button("loading");
            dispatcher.trigger("collectionitems:add", {
                item: this.model.item,
                collection: selectedCollection,
                search_result_item: this.model,
            });
        }

    });

    /* Display the pagination for the search results */
    var LCSearchItemListPaginationView = Backbone.View.extend({
        el: $("#search-pagination"),
        template: _.template($('#t-search-pagination').html()),

        events: {
            "click .next": "nextPage",
            "click .previous": "previousPage",
        },

        previousPage: function () {
            if (this.show_previous()) {
                this.model.setPage(this.model.attributes.start - this.model.attributes.limit);
            }
        },

        nextPage: function () {
            if (this.show_next()) {
                this.model.setPage(this.model.attributes.start + this.model.attributes.limit);
            }
        },

        show_previous: function () {
            return this.model.attributes.start > 0;
        },

        show_next: function () {
            return (this.model.attributes.start + this.model.attributes.limit) < this.model.attributes.count;
        },

        render: function () {
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
        el: $("#search-results-count"),
        events: {
            "click .savesearch": "saveSearch",
        },
        template: _.template($('#t-search-results-count').html()),
        render: function () {
            this.$el.html(this.template(_.extend(
        {
            page_end: Math.min(this.model.attributes.start + this.model.attributes.limit, this.model.attributes.count),
            page_start: Math.min(this.model.attributes.start + 1, this.model.attributes.count),
        },
        this.model.attributes)));
            return this;
        },

        saveSearch: function () {
            var filename = 'bob.txt';
            var ids = _.pluck(_.pluck(lcSearchResultItems.models, "item"), "id").join('\r\n');
            dispatcher.trigger("items:download", { ids: ids, filename: filename, });
        },
    });

    /**********************************************************

    PERMISSIONS

    ***********************************************************/

    var makeOwner = function (user, collection) {
        dispatcher.trigger("userpermissions:add", {
            user: user,
            role: lcRoles.find(function (r) {
                return r.attributes.name == "owner";
            }),
            collection: collection,
        });
    };

    var makeEditor = function (user, collection) {
        dispatcher.trigger("userpermissions:add", {
            user: user,
            role: lcRoles.find(function (r) {
                return r.attributes.name == "editor";
            }),
            collection: collection,
        });
    };

    var removeUser = function (user, collection) {
        dispatcher.trigger("userpermissions:remove", {
            user: user,
            collection: collection,
        });
    };

    /* Manage the user search function */
    var LCUserSearchFormView = Backbone.View.extend({
        el: $("#edit-collection-permissions form.user-search"),
        template: _.template($('#edit-collection-permissions form.user-search').html()),
        events: {
            "submit": "search",
        },
        search: function () {
            dispatcher.trigger("user:search", {
                query: this.$el.find("input").val(),
            });
        }
    });

    var LCUserSearchItemView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template($('#t-user-searchresults-list-item').html()),
        events: {
            "click button.make-owner": "makeOwner",
            "click button.make-editor": "makeEditor",
        },

        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        makeOwner: function (e) {
            makeOwner({ id: this.model.attributes.id, name: this.model.attributes.name, email: this.model.attributes.email}, selectedCollection);
        },
        makeEditor: function (e) {
            makeEditor({ id: this.model.attributes.id, name: this.model.attributes.name, email: this.model.attributes.email }, selectedCollection);
        },



        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },
    });

    /* Display the user search results */
    var LCUserSearchListView = new Backbone.CollectionView({
        el: $("table#user-searchresults-list"),
        selectable: false,
        collection: lcUserSearchItems,
        modelView: LCUserSearchItemView,
    });


    /* Edit collection permissions */
    var LCCollectionPermissionView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template($('#t-edit-collection-permissions-item').html()),
        events: {
            "click button.make-owner": "makeOwner",
            "click button.make-editor": "makeEditor",
            "click button.remove-user": "removeUser",
        },
        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            this.$el.html(this.template(
                _.extend(this.model.attributes,
                {
                    owner: this.model.attributes.role.name == "owner",
                    editor: this.model.attributes.role.name == "editor",
                })));
            return this;
        },

        makeOwner: function (e) {
            makeOwner(this.model.attributes.user, selectedCollection);
        },
        makeEditor: function (e) {
            makeEditor(this.model.attributes.user, selectedCollection);
        },
        removeUser: function (e) {
            removeUser(this.model, selectedCollection);
        },
    });

    /* Display the user permissions */
    var lcCollectionPermissionListView = new Backbone.CollectionView({
        el: $("table#user-list"),
        selectable: false,
        collection: lcPermissions,
        modelView: LCCollectionPermissionView,
    });



    /**********************************************************

    API KEY

    ***********************************************************/

    /* Edit API Key */
    var LCAPIKeyEditView = Backbone.View.extend({
        el: $("#edit-api-key"),
        template: _.template($('#t-edit-api-key').html()),
        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        events: {
            "click .save": "saveKey",
        },

        render: function () {
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

        saveKey: function () {
            this.model.set("key", this.$("#editAPIKey").val());
            this.model.save();
            dispatcher.trigger("collection:refresh");
            $(".modal").modal('hide');
        },

    });

    /* Display API key button */
    var LCPageTitleView = Backbone.View.extend({
        el: $("h1"),
        template: _.template($('#t-title').html()),
        initialize: function () {
            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            $(".api-key-alert").toggle(!this.model.isKeySet());
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

    });

    /************************** Initialization **************************/

    Backbone.history.start()

    /* Get the API Key */
    var apiKey = new LCAPIKey();
    apiKey.fetch();

    /* Get the collection list and display it */
    $("#loading-collections-please-wait").modal();
    lcCollections.fetch({
        success: function() {
            $("#loading-collections-please-wait").modal('hide');
        },
        error: function(obj, response, opts) {
            $("#loading-collections-please-wait .modal-body").html("<p>Unable to reach Collections API. Please check that you have entered a valid API Key</p><p>Reason: "+response.statusText+"</p><p>API Url: "+obj.url+"</p><div class='form-group'><button type='button' class='btn btn-default ' data-dismiss='modal'>Ok</button></div>");
        }
    });

    /* Get the list of possible roles */
    lcRoles.fetch();

    /* Collection display and editing views */
    /* Display a list of collections */
    var lcCollectionListView = new Backbone.CollectionView({
        el: $("ul#collection-list"),
        selectable: false,
        collection: lcCollections.sort(),
        modelView: LCCollectionView,
    });

    lcCollectionListView.render();


    /* Display the list of items from the selected collection */
    var lcCollectionItemListView = new Backbone.CollectionView({
        el: $("table#item-list"),
        selectable: false,
        collection: lcCollectionItems,
        modelView: LCCollectionItemListRowView,
    });

    var selectedCollection = new LCCollection();
    var titleView = new LCCollectionDetailTitleView({ model: selectedCollection });
    titleView.render();
    var editCollectionView = new LCCollectionEditView({ model: selectedCollection });
    editCollectionView.render();
    var uploadCollectionView = new LCCollectionUploadView({ model: selectedCollection });
    uploadCollectionView.render();
    var addCollectionButtonView = new LCCollectionAddView();
    addCollectionButtonView.render();
    var batchItemUploadView = new LCBatchItemUploadView({ model: selectedCollection });
    batchItemUploadView.render();




    /* Permissions views */
    var userSearchView = new LCUserSearchFormView();

    /* Search views */
    /* Display the search results */
    var lcSearchItemListView = new Backbone.CollectionView({
        el: $("table#search-results-list"),
        selectable: false,
        collection: lcSearchResultItems,
        modelView: LCSearchItemView,
    });

    var searchView = new LCSearchFormView({ model: selectedCollection });
    var searchPaginationView = new LCSearchItemListPaginationView({ model: lcSearchResultItems });
    var searchResultCountView = new LCSearchItemListResultCountView({ model: lcSearchResultItems });

    /* Other views */
    var apiKeyView = new LCAPIKeyEditView({ model: apiKey });
    apiKeyView.render();
    var pageTitleView = new LCPageTitleView({ model: apiKey });
    pageTitleView.render();
    var pagerView = new LCCollectionItemListViewPager();

    /* File upload */
    $('document').ready(function () {
        if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
            $('#files').hide();
        }
    });

    /* Display alert if no API key at launch */
    if (apiKey.isKeySet()) {
        $(".api-key-alert").hide();
    }

});
