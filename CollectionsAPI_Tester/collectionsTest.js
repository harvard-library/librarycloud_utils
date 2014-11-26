var BASEURL = "http://collections-api.lib.harvard.edu/v2/";
//var BASEURL = "<BASE URL FOR COLLECTIONS API>";
var collections;
//var items = [];


$('#put').click(function(){
    updateErrorLabel('');

    var collectionID = $('#updateID').val();
    var title = $('#updateTitle').val();
    var abstract = $('#updateAbstract').val();

    updateCollection(collectionID, title, abstract);
});

$('#post').click(function(){
    updateErrorLabel('');
    var title = $('#newTitle').val();
    var abstract = $('#newAbstract').val();
    saveNew(title, abstract);
});

$('#addItemsButton').click(function(){
    updateErrorLabel('');
    var itemList = $('#addItemsTextArea').val().split('\n');
    var collectionID = $('#updateID').val();

    addItems(collectionID, itemList);
});


var updateErrorLabel = function(message){
    message = '<strong><span style="color:red">' + message + '</span></strong>';
    $('#errorLabel').html(message);
};

$.ajaxSetup({
    statusCode: {
        401: function(){
            updateErrorLabel('Error: Unauthorized! Please check your user API token is valid.');
        },
        404: function(){
            updateErrorLabel('Error: Remote resource not found.');
        },
    }
});

var getHeader = function()
{
    var token = $('#userAPITokenText').val();
    if(!token || token == ""){
        token = 999999999;
    }
    return {
         
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-LibraryCloud-API-Key': token
            };
}

var addItems = function(collectionID, itemIdList){
    var itemList = []; //not sure if this is really necessary
    $.each(itemIdList, function(index, itemId){
        if(itemId.length > 0)
            itemList.push({item_id: itemId});
    })

     $.ajax({ 
         type: "POST",
         headers: getHeader(),
         url: BASEURL + "collections/" + collectionID,
         data: JSON.stringify(itemList, null, 2),
         dataType: 'json',
         success: function(data){     
            getItemData(collectionID)
         }
     }).done(function()  { 
        $('#newTitle').val('');
        $('#newAbstract').val('');
         getCollectionData(); 
     });
     
    
};


var saveNew = function(title, abstract){
     $.ajax({ 
         type: "POST",
         headers: getHeader(),
         url: BASEURL + "collections.json",
         data: JSON.stringify({title: title, abstract: abstract}, null, 2),
         dataType: 'json',
         success: function(data){        
         }

     }).done(function() { alert('created');}).always(function() { 
        $('#newTitle').val('');
        $('#newAbstract').val('');
         getCollectionData(); });
};

var getCollectionData= function(){
     $.ajax({ 
         type: "GET",
         dataType: "json",
         url: BASEURL + "collections.json",
         success: function(data){        
            collections = data;
            displayCollections(data);
         }
     });
 };

 var getItemData = function(collectionID){
    var items = [];
    var hydratedItems =[];

     $.ajax({ 
         type: "GET",
         dataType: "json",
         url: BASEURL + "collections/" + collectionID + "/items",
         success: function(data){        
            items = data;
            
         }
     }).done(function(){

         var promiseList = [];

         $.each(items, function(index, item){
            promiseList.push(
             $.ajax({
                 type: "GET",
                 dataType: "json",
                 url: "http://api.lib.harvard.edu/v2/items.dc.json?recordIdentifier=" + item.item_id ,
                 success: function(data, textStatus, jqXHR){        
                    if(data.pagination.numFound != '0') //found a record
                    {
                        var t = Array.isArray(data.item.title) ? data.item.title[0] : data.item.title;
                        hydratedItems.push({item_id:item.item_id , title: t })
                    } else { //not found
                        hydratedItems.push({item_id: item.item_id, title: 'Item not found.'});
                    }
                    //hydratedItems.push(data); //add to list of items to be inserted.                
                }})

             );

         });
         $.when.apply($, promiseList).done(function(){
            displayItems(collectionID, hydratedItems);
         });
         
    });
 };



 var loadUpdateCollection = function(collectionID){
    var test = collections.filter(function(element, index){
        return element.identifier == collectionID;
    });
    $('#updateTitle').val(test[0].title);
    $('#updateAbstract').val(test[0].abstract);
    $('#updateID').val(collectionID);
    $('#updateRow').show();
    $('#updateItemsRow').show();

    getItemData(collectionID);
 };

 var updateCollection = function(collectionID, title, abstract){
     $.ajax({ 
         type: "put",
         headers: getHeader(),
         url: BASEURL + "collections/" + collectionID + '/',
         data: JSON.stringify({title: title, abstract: abstract}, null, 2),
         dataType: 'json',
         success: function(data){        
            getCollectionData();
         }
     });
 };

 var deleteCollection= function(collectionID){
    updateErrorLabel('');
     $.ajax({ 
         type: "Delete",
         headers: getHeader(),
         url: BASEURL + "collections/" + collectionID + '/',
         
         dataType: 'json',
         success: function(data){        
            getCollectionData();
         }
     });

 };

 var deleteCollectionItem = function(itemId, collectionID){
    updateErrorLabel('');
     $.ajax({ 
         type: "Delete",
         headers: getHeader(),
         url: BASEURL + "collections/" + collectionID + '/items/' + itemId,
         
         dataType: 'json',
         success: function(data){        
            getItemData(collectionID);
         }
     });

 };

var displayItems = function(collectionId, itemList){
    updateErrorLabel('');
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
        {title: 'Title', data:'Title'},
        {title:'Delete', data:'Delete'}]});
    }
    
    table.clear();

    $.each((itemList),function(index,item){
        var deleteButtonString = '<button onclick=\'deleteCollectionItem("' + item.item_id.replace(/"/g,'') + '", ' + collectionId +  ')\'>Delete</button>';
        table.row.add({ID: item.item_id, Title: item.title,
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

getCollectionData();