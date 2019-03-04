module.exports = {
    getPrice: function(mrp,discount){
        return Math.round((mrp - mrp*(discount/100)))
    },

    getDeliveryTime: function(mrp,discount){
        var hours = new Date().getHours();
        if(hours<=17){
            return 'Today Before 8:00 PM';
        }else if(hours>17){
            if(hours<=12){
                return 'Tomorrow Before '+ hours + ':00'+ ' AM';
            }else{
                return 'Tomorrow Before '+ hours + ':00'+ ' PM';
            }
            
        }
    },

    getOrderProductObjectForMail: function(books){
        var object = {}
        for (var i = 0; i < books.length; i++) {
            var j = i+1;
            object['merge_bookTitle'+j] = books[i].title
            object['merge_bookAuthor'+j] = books[i].author
            object['merge_bookPublisher'+j] = books[i].publisher
            object['merge_bookPrice'+j] = books[i].price
            object['merge_bookQuantity'+j] = books[i].quantity
        }
        return object;
    }

    
}