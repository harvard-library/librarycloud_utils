        var collections;
        var items = [];

        $('#json').click(function(){ 
            alert('json');
             $.getJSON("http://libcloud-renaud:8080/collections/v2/collections.json",
             function(data) {
                alert(data);         
              });   
        });
/*        $.get('http://libcloud-renaud:8080/collections/v2/collections.xml', 

            function(data, status, response){

                alert(response.responseText);

            });
  */
        $('#ajax').click(function(){ 
           getCollectionData(); 

        });

        $('#put').click(function(){
            var collectionID = $('#updateID').val();
            var title = $('#updateTitle').val();
            var abstract = $('#updateAbstract').val();

            updateCollection(collectionID, title, abstract);
        });

        $('#post').click(function(){
            var title = $('#newTitle').val();
            var abstract = $('#newAbstract').val();
            saveNew(title, abstract);
        });

        var saveNew = function(title, abstract)
        {
             $.ajax({ 
                 type: "POST",
                 headers: {
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'},
                 url: "../collections/v2/collections.json",
                 data: JSON.stringify({title: title, abstract: abstract}, null, 2),
                 dataType: 'json',
                 success: function(data){        
                 }

             }).done(function() { alert('created');}).always(function() { 
                $('#newTitle').val('');
                $('#newAbstract').val('');
                 getCollectionData(); });
/*        $.post(url:"http://libcloud-renaud:8080/collections/v2/collections.json", data: {title: title, abstract: abstract},
                success: function(data){        
                    getData();
                 }
            );*/
        };

        var getCollectionData= function()
        {
             $.ajax({ 
                 type: "GET",
                 dataType: "json",
                 url: "../collections/v2/collections.json",
                 success: function(data){        
                    collections = data;
                    displayCollections(data);
                 }
             });

         };

         var getItemData = function(collectionID)
         {
             $.ajax({ 
                 type: "GET",
                 dataType: "json",
                 url: "../collections/v2/collections/" + collectionID + "/items",
                 success: function(data){        
                    items = data;
                    displayItems(collectionID, data);
                 }
             });
         };



         var loadUpdateCollection = function(collectionID){
            var test = collections.filter(function(element, index){
                return element.identifier == collectionID;
            });
            $('#updateTitle').val(test[0].title);
            $('#updateAbstract').val(test[0].abstract);
            $('#updateID').val(collectionID);
            getItemData(collectionID);
         };

         var updateCollection = function(collectionID, title, abstract)
         {
             $.ajax({ 
                 type: "put",
                 headers: {
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'},
                 url: "../collections/v2/collections/" + collectionID + '/',
                 data: JSON.stringify({title: title, abstract: abstract}, null, 2),
                 dataType: 'json',
                 success: function(data){        
                    getCollectionData();
                 }
             });
         };

         var deleteCollection= function(collectionID)
         {
             $.ajax({ 
                 type: "Delete",
                 headers: {
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'},
                 url: "../collections/v2/collections/" + collectionID + '/',
                 
                 dataType: 'json',
                 success: function(data){        
                    getCollectionData();
                 }
             });

         };

         var deleteCollectionItem = function(itemId, collectionID)
         {
             $.ajax({ 
                 type: "Delete",
                 headers: {
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'},
                 url: "../collections/v2/collections/" + collectionID + '/items/' + itemId,
                 
                 dataType: 'json',
                 success: function(data){        
                    getItemData(collectionID);
                 }
             });

         };

        var displayItems = function(collectionId, itemList)
        {
            var table;
             if($.fn.dataTable.isDataTable( '#itemTable' ))
             { table  = $('#itemTable').DataTable();
             }
             else {
                   table = $('#itemTable').DataTable({
                searching: false,
                paging: false,
                columns:[
                {title: 'ID', data:'ID'}, 
                {title:'Delete', data:'Delete'}]});
            }
            
            table.clear();
            $.each((itemList),function(index,item){
                var deleteButtonString = '<button onclick="deleteCollectionItem(' + item.item_id.replace(/"/g,'') + ', ' + collectionId +  ')">Delete</button>';
                table.row.add({ID: item.item_id, 
                    Delete: deleteButtonString});

            });
            table.draw();
        };

        var displayCollections = function(collectionList) {
            var table;
             if($.fn.dataTable.isDataTable( '#collectionTable' ))
             { table  = $('#collectionTable').DataTable();
             }
             else {
                   table = $('#collectionTable').DataTable({
                searching: false,
                paging: false,
                columns:[
                {title: 'ID', data:'ID'}, 
                {title:'Title', data:'Title'}, 
                {title:'Abstract',data:'Abstract'},
                {title:'Update', data:'Update'},
                {title:'Delete', data:'Delete'}]});
            }

            table.clear();
            $.each((collectionList),function(index,collection){
              /*  $('<tr><td>' + collection.identifier 
                    + '</td><td>' + collection.title 
                    + '</td><td>' + collection.abstract
                    + '</td></tr>').appendTo('#collectionTable');
*/
                var updateButtonString = '<button onclick=loadUpdateCollection(' + collection.identifier + ')>Update</button>';

                var deleteButtonString = '<button onclick=deleteCollection(' + collection.identifier + ')>Delete</button>';
                table.row.add({ID: collection.identifier, 
                    Title: collection.title, 
                    Abstract: (collection.abstract || ''),
                    Update: updateButtonString,
                    Delete: deleteButtonString});

            });
            table.draw();

        };
