var axios = require('axios');
var Key = require('./../config/keys');


//SEND PASSWORD RESET MAIL

exports.sendPasswordResetMail




//SEND FEEDBACK EMAIL
exports.sendFeedbackEmail = function(customerEmail,customerName){
    return new Promise((resolve,reject)=>{
        axios({
            method : 'post',
            url : Key.mailApiUrl,
            responseType : 'json',
            params : {
                apikey : Key.elasticEmailApiKey,        
                to: customerEmail,
                template : 14738,
                merge_customerName : customerName,
            }
        })
        .then(response=>{
            resolve(response.data)
        })
        .catch(err=>{
            reject(err);
        });
    });
        

        
}


//SEND DISPATCHED EMAIL
exports.sendDispatchedEmail = function(customerEmail,customerName,orderNumber,orderAddress,deliveryBoyName,deliveryBoyNumber){
    return new Promise((resolve,reject)=>{
        axios({
            method : 'post',
            url : Key.mailApiUrl,
            responseType : 'json',
            params : {
                apikey : Key.elasticEmailApiKey,       
                to: customerEmail,
                template : 14809,
                merge_customerName : customerName,
                merge_orderNumber : orderNumber,
                merge_orderAddress : orderAddress,
                merge_deliveryBoyName : deliveryBoyName,
                merge_deliveryBoyNumber : deliveryBoyNumber
            }
        })
        .then(response=>{
            resolve(response.data)
        })
        .catch(err=>{
            reject(err);
        });
    });
    
}


//SEND DELIVERED EMAIL
exports.sendDeliveredEmail = function(customerEmail,customerName,orderNumber){
    return new Promise((resolve,reject)=>{
        axios({
            method : 'post',
            url : Key.mailApiUrl,
            responseType : 'json',
            params : {
                apikey : Key.elasticEmailApiKey,        
                to: customerEmail,
                template : 14809,
                merge_customerName : customerName,
                merge_orderNumber : orderNumber
            }
        })
        .then(response=>{
            resolve(response.data)
        })
        .catch(err=>{
            reject(err);
        });
    });
    
}

//SEND CONFIRMED EMAIL
module.exports.sendConfirmedEmail = function(customerEmail,customerName,orderNumber){
    return new Promise((resolve,reject)=>{
        axios({
            method : 'post',
            url : Key.mailApiUrl,
            responseType : 'json',
            params : {
                apikey : Key.elasticEmailApiKey,       
                to: customerEmail,
                template : 14849,
                merge_customerName : customerName,
                merge_orderNumber : orderNumber
            }
        })
        .then(response=>{
            resolve(response.data)
        })
        .catch(err=>{
            reject(err);
        });
    });
}


