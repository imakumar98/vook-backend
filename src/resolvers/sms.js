//ORDER PROCESSED SMS TEXT
module.exports = {
    getOrderProcessedText = (customerName,orderId, deliveryTime)=>{
        return `
            Hi ${customerName},\n
            Your order has been confirmed. You will get your books by ${deliveryTime}. \n
            Thanks & RegardS \n
            Vook Team
        `;   
    }
}