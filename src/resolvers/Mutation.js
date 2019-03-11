//IMPORT LIBRARIES
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {randomBytes} = require('crypto');
const axios = require('axios');

//IMPORT UTIL FUNCTIONS
const calcTotalPrice = require('./calcTotalPrice');
const {getOrderProductObjectForMail, getPrice} = require('./utilFunctions');

const Mutation = {

    //SIGN UP RESOLVER
    async signup(parent,args,ctx,info){

        //1. LOWER THE EMAIL ADDRESS
        args.email = args.email.toLowerCase();
    
        //2. HASH THE PASSWORD
        args.password = await bcrypt.hash(args.password,10);

        //3. CREATE THE USER
        const user = await ctx.db.mutation.createUser({
            data: {
               ...args,
               password : args.password,
               permissions: {set: ['USER']}
            }
        },info);

        //4. CREATE THE JWT TOKEN
        const token = jwt.sign({userId: user.id},process.env.TOKEN_SALT);

        //5. SET THE JWT AS COOKIE ON RESPONSE
        ctx.response.cookie('token',token,{
            httpOnly: true,
            maxAge: 1000 * 60 * 24 * 365,//1 YEAR
        });

        //6. FINALLY RETURN THE USER TO BROWSER
        return user;


     },

     //SIGNIN RESOLVER
     async signin(parent,{email,password},ctx,info){
        
        //1. CHECK IF THERE IS A USER WITH THAT EMAIL
        const user = await ctx.db.query.user({where: {email}});
        if(!user) throw new Error(`No such user found for email ${email}`);
        
        //2. CHECK IF THEIR PASSWORD IS CORRECT
        const valid = await bcrypt.compare(password,user.password);
        if(!valid) throw new Error('Invalid Password');
        
        //3. GENERATE THE JWT TOKEN
        const token = jwt.sign({userId: user.id},process.env.TOKEN_SALT);
        
        //4. SET THE COOKIE WITH THE TOKEN
        ctx.response.cookie('token',token,{
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365,//1 YEAR
        });

        //5. RETURN THE USER
        return user;

     },

    //SIGNOUT RESOLVER
    signout(parent,args,ctx,info){
         ctx.response.clearCookie('token');
         return {message:  'Goodbye!'};
     },

    //REQUEST RESET RESOLVER
    async requestReset(parent,args,ctx,info){

        //1. CHECK IF USER IS REAL
        const user = await ctx.db.query.user({where: {email:args.email}});
        if(!user) throw new Error(`No such user found for email ${args.email}`);
        
        //2. SET A RESET TOTKEN AND EXPIRY ON THAT USER
        const randomBytesPromisified = promisify(randomBytes);
        const resetToken = (await randomBytesPromisified(20)).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; //1 hour from now
        const res = await ctx.db.mutation.updateUser({
            where : {email:args.email},
            data: {resetToken,resetTokenExpiry}
        });
        
        //3. EMAIL THEM THAT RESET TOKEN
        const response = await axios({
            method: 'post',
            url: process.env.ELASTIC_EMAIL_API_URL,
            responseType: 'json',
            params: {
                apikey: process.env.ELASTIC_EMAIL_API_KEY,        
                to: args.email,
                isTransactional: true,
                template: 17793,
                merge_customerName: user.name,
                merge_resetToken: process.env.FRONTEND_URL + '/reset?resetToken='+resetToken
            }
        });

        //4. CHECK IF SOMETHING IS WRONG
        if(!response.data.success) throw new Error("Something went wrong");
        
        //5. RETURN THE MESSAGE 
        return {message : 'Thanks!'};
        
    },

    //RESET PASSWORD RESOLVER
    async resetPassword(parent,args,ctx,info){
        //1. CHECK IF THE PASSWORD MATCH
        if(args.password !== args.confirmPassword) throw new Error("Passwords dont match");
        
        //2. Check if its a legit reset token
        //3. CHECK IF ITS EXPIRED OR NOT
        const [user] = await ctx.db.query.users({
            where: {
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000
            }
        });
        if(!user) throw new Error("This token is either invalid or expired!");
        
        
        //4. HASH NEW PASSWORD
        const password = await bcrypt.hash(args.password,10) ;
        
        //5. SAVE THE NEW PASSWORD TO USER AND REMOVE OLD RESET TOKEN FIELDS
        const updatedUser = await ctx.db.mutation.updateUser({
            where: {email: user.email},
            data: {
                password,
                resetToken: null,
                resetTokenExpiry: null
            }
        })
        //6. GENERATE JWT
        const token = jwt.sign({userId: updatedUser.id},process.env.TOKEN_SALT);
        //7. SET THE JWT TOKEN
        ctx.response.cookie('token',token,{
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365
        })
        //8. RETURN THE UPDATED USER
        return updatedUser;
        
    },

    async addToCart(parent,args,ctx,info){

        //1. MAKE SURE THEY ARE SIGNED IN 
        const {userId} = ctx.request; 
        if(!userId){
            throw new Error("You must be signed in soon");
        }
        
        //2. QUERY THE USER'S CURRENT CART
        const [existingCartBook] = await ctx.db.query.cartBooks({
            where: {
                user: {id: userId},
                book: {id: args.id}
            }
        });
        
        //3. CHECK IF THAT BOOKS IS ALREADY IN THEIR CART AND INCREMENT BY 1 IF IT IS ACCORDING TO TYPE
        if(existingCartBook){
            if(args.type=='IncrementByOne'){
                return ctx.db.mutation.updateCartBook({
                    where: {id: existingCartBook.id},
                    data: {quantity: existingCartBook.quantity + 1},
                },info)
            }else if(args.type=='UpdateQuantity'){
                
                return ctx.db.mutation.updateCartBook({
                    where: {id: existingCartBook.id},
                    data: {quantity: parseInt(args.quantity)},
                },info)
            }
        }
        
        //4. IF ITS NOT, CREATE A FRESH CART PRRODUCT FOR THAT USER
        return ctx.db.mutation.createCartBook({
            data: {
                user: {
                    connect: {id: userId},  
                },
                book: {
                    connect: {
                        id: args.id
                    }
                },
                quantity: args.quantity
            }
        },info)
    },

    async removeFromCart(parent,args,ctx,info){
        //1. FIND THE CART PRODUCT
        
        const cartBook = await ctx.db.query.cartBook({
            where: {
                id: args.id
            },
        },
            `{id, user{ id }}`
        );
        
        //1. MAKE SURE WE FOUND AN PRODUCT
        if(!cartBook){
            throw new Error("No Book Found!");
        }
        
        //2. MAKE SURE THEY OWN THAT CART PRODUCT
        if(cartBook.user.id !==ctx.request.userId){
            throw new Error('Cheatin huhh');
        }
        //3. Delete that cart product
        return ctx.db.mutation.deleteCartBook({
            where: {id: args.id},
        },info);
    },

    async createOrder(parent,args,ctx,info){
        
        //1. QUERY THE CURRENT USER AND MAKE SURE THEY ARE SIGNED IN
        const {userId} = ctx.request;
        if(!userId) throw new Error("You must be signed in to complete this order.");
        const user = await ctx.db.query.user({where: {id: userId}},
            `{
                id 
                name 
                email 
                walletBalance
                cart {
                    id 
                    quantity 
                    book {
                        id
                        title
                        author
                        publisher{
                            name
                            discount
                        }
                        mrp 
                        images {
                            src
                        }
                    }
                }
            }`
        );

        console.log(user.cart);

        //2. CHECK FOR ALL REQUIRED FIELD PROVIDED(VALIDATION)
        if(!args.number) throw new Error("Phone number field is required!! ");
        
        if(args.number.length!==10) throw new Error("Phone number must be 10-digit value!!");
        
        if(!args.streetAddress) throw new Error("Street Address field is required!!");
        
        if(!args.city) throw new Error("City field is required!!");
        
        if(!args.state) throw new Error("State field is required!!");
        
        if(!args.postalCode) throw new Error("Postal Code/Zip field is required!!");
        
        
       
        //4. UPDATE USER ADDRESS AND EMAIL IF USER SELECTED SET IT DEFAULT
        if(args.addressSetToDefault==true){
            const res = await ctx.db.mutation.updateUser({
                where: {id: userId},
                data: {
                    number: args.number,
                    streetAddress: args.streetAddress,
                    city: args.city,
                    state: args.state,
                    postalCode: String(args.postalCode)
                }
            });
            if(!res) throw new Error("Unable to save User data");
        }

        //4. VALIDATE POSTAL CODE
        const postalCode = await ctx.db.query.postalCode({where: {code: String(args.postalCode)}});
        if(!postalCode) throw new Error(`Sorry!! But Vook Services Are Not Available At ${args.postalCode}`);
        
        //5. RECALCULATE THE TOTAL PRICE FOR ASSURANCE
        const subTotal = calcTotalPrice(user.cart);
        var total = subTotal;
        
        if(args.isVookBalanceUsed) total = subTotal - user.walletBalance
        
        if(args.couponCode){
            //SOLVE FOR COUPON CODE
            var couponCode = args.couponCode;
        }

        //6. CONVERT CART PRODUCTS TO ORDER PRODUCTS
        const orderItems = user.cart.map(cartItem=>{
            const orderItem = {
                title: cartItem.book.title,
                author: cartItem.book.author,
                publisher: cartItem.book.publisher.name,
                price: getPrice(cartItem.book.mrp,cartItem.book.publisher.discount),
                image: cartItem.book.images[0].src,
                quantity: cartItem.quantity,
                user: { connect: {id: userId} }
            }
            delete orderItem.id;
            return orderItem;
        })

        //7. CREATE THE ORDER

        //7.1 CREATE READABLE ORDER ID
        var lastOrder = await ctx.db.query.orders({last:1});
        if(lastOrder.length==0){
            var orderId = 2019500;
        }else{
            var lastOrderId = lastOrder[0].orderId;
            var orderId = lastOrderId + 1;
        }
        
        //7.2 SAVE THE ORDER IN DATABASE
        const order = await ctx.db.mutation.createOrder({
            data: {
                isVookBalanceUsed:  args.isVookBalanceUsed,
                couponCode: args.couponCode,
                streetAddress: args.streetAddress,
                phone: args.number,
                email: args.email,
                city: args.city,
                state: args.state,
                postalCode: args.postalCode,
                subTotal: subTotal,
                total: total,
                status: 1,
                orderDateTime: new Date(),
                books: {create: orderItems},
                user: {connect: {id:userId}},
               orderId: orderId
            }
        },info)

        //8. CLEAN UP - CLEAR THE USER CART, DELETE CART PRODUCTS
        const cartBookIds = user.cart.map(cartItem=>cartItem.id);
        await ctx.db.mutation.deleteManyCartBooks({where: {
            id_in: cartBookIds
        }})

        //9. Create Order Invoice




        //10 Send Email/SMS for successfull order creation With Order Invoice as attachment(TO CUSTOMER)

        //10.1 SEND MAIL CONFIRMATION
        console.log("Confirmation mail sent");

        //10.2 SEND SMS CONFIRMATION
        console.log("SMS for Order Confirmation Sent");
        
        

        //11 SEND EMAIL FOR THE ORDER GENERATION(TO ME)
        const object = getOrderProductObjectForMail(order.books);
        const response = await axios({
            method: 'post',
            url: process.env.ELASTIC_EMAIL_API_URL,
            responseType: 'json',
            params: {
                ...object,
                apikey: process.env.ELASTIC_EMAIL_API_KEY,        
                to: process.env.ADMIN_EMAIL,
                isTransactional: true,
                merge_customerName: user.name,
                template: 18667,
                merge_address1: 'RC- Prasant Garden Khora Colony',
                merge_address2: 'Noida,201301, Uttar Pradesh',
                merge_subTotal: order.subTotal,
                merge_total: order.total
            }
        })

        console.log(response.data);
        

        //12. Return the Order to the client
        return order;
    },

    async submitContactUs(parent,args,ctx,info){
        if(!args.firstName) throw new Error("First Name field is Required!!");
        
        if(!args.lastName) throw new Error("Last Name field is Required!!");
        
        if(!args.email) throw new Error("Email field is Required!!");
        
        if(!args.number) throw new Error("Contact number field is Required!!");
        
        if(!args.message)  new Error("Message field is Required!!");
        

        //EMAIL INFORMATION TO ADMIN
        const response = await axios({
            method: 'post',
            url: process.env.ELASTIC_EMAIL_API_URL,
            responseType: 'json',
            params: {
                apikey: process.env.ELASTIC_EMAIL_API_KEY,        
                to: process.env.ADMIN_EMAIL,
                isTransactional: true,
                template: 18710,
                merge_adminName: process.env.ADMIN_NAME,
                merge_firstName: args.firstName,
                merge_lastName: args.lastName,
                merge_email: args.email,
                merge_number: args.number,
                merge_message: args.message
            }
        })
        if(!response.data.success) throw new Error("Something went wrong");
        
        return {message : 'Your query has been submitted successfully!! We will contact you very soon.'};
    },

    //CREATE POSTAL CODE
    async createPostalCode(parent,args,ctx,info){
        const code = await ctx.db.query.postalCodes({
            where: {
                code: args.code
            }
        });

        if(code.length>0) throw new Error(args.code + " already exist");
        

        return ctx.db.mutation.createPostalCode({
            data: {
                code: args.code
            }
        },info);

    },

    

    //CREATE CATEGORY MUTATION
    async createCategory(parent,args,ctx,info){
        const name = await ctx.db.query.category({
            where: {name: args.name.toLowerCase()}
        });
        if(name) throw new Error("This category already exist!!");
        const res = await ctx.db.mutation.createCategory({
            data: {
                name : args.name.toLowerCase()
            }
        });
        if(!res) throw new Error("Something Went Wrong");
        return {message: "Category Created Successfully!!"}
    },

    //CREATE TYPE MUTATION
    async createType(parent,args,ctx,info){
        const name = await ctx.db.query.type({
            where: {name: args.name.toLowerCase()}
        });
        if(name) throw new Error("This category already exist!!");
        const category = await ctx.db.query.category({
            where : {name: args.category.toLowerCase()}
        });
        if(!category) throw new Error("You provide unknown category");
        const res = await ctx.db.mutation.createType({
            data: {
                name : args.name.toLowerCase(),
                category: {connect: {id: category.id}}
            }
        });
        if(!res) throw new Error("Something Went Wrong");
        return {message: "Type " + args.name +  " Created Successfully!!"}
    },

    //CREATE PUBLISHER MUTATION
    async createPublisher(parent,args,ctx,info){
        const name = await ctx.db.query.publisher({
            where: {name: args.name.toLowerCase()}
        },info);
        if(name) throw new Error("This publisher already exist!!");
        const type = await ctx.db.query.type({
            where : {name: args.type.toLowerCase()}
        });
        if(!type) throw new Error("You provide unknown type");
        const res = await ctx.db.mutation.createPublisher({
            data: {
                name : args.name.toLowerCase(),
                type : {connect: {id: type.id}},
                discount: args.discount
            }
        });
        if(!res) throw new Error("Something Went Wrong");
        return {message: "Publisher " + args.name +  " Created Successfully!!"}
    },

    //CREATE BOOK MUTATION
    async createBook(parent,args,ctx,info){
        const slug = await ctx.db.query.book({
            where : {slug: args.slug}
        },info); 

        if(slug) throw new Error("Slug Already Exist");

        if(args.images.length<1) throw new Error("Upload Image is Must");

        var lastSKU = await ctx.db.query.books({last:1});
        if(lastSKU.length==0){
            var sku = 1000;
        }else{
            var lastSKU = lastSKU[0].sku;
            var sku = lastSKU + 1;
        }

        const publisher = await ctx.db.query.publisher({
            where: {name: args.publisher}
        });
        const type = await ctx.db.query.type({
            where: {name: args.type}
        });
        const category = await ctx.db.query.category({
            where: {name: args.category}
        });

        var tags = args.tags.map((tag)=>{
            return {text: tag}
        });

        var images = args.images.map((image)=>{
            return {src: image}
        })
        const book = await ctx.db.mutation.createBook({
            data: {
                sku: sku,
                title: args.title,
                author: args.author,
                category: {connect: {id: category.id}},
                publisher: {connect: {id: publisher.id}},
                type: {connect: {id: type.id}},
                subject: args.subject,
                edition: args.edition,
                active: true,
                quantity: args.quantity,
                detail: args.detail,
                description: args.description,
                mrp: parseInt(args.mrp),
                slug: args.slug,
                tags : {
                    create : tags
                },
                images : {
                    create: images
                },
                dateTime: new Date()
            }
        },info);
        
        return book;
    },

    async deleteBook(parent,args,ctx,info){

        //CHECK IF THAT BOOK EXIST
        const book = await ctx.db.query.book({
            where: {id:args.id}
        });
        if(!book) throw new Error("You passed wrong ID of book");

        const res = await ctx.db.mutation.deleteBook({
            where: {id: args.id}
        });
        if(!res) {
            console.log(book);
            throw new Error("Something went wrong");
        }
        return {message: "Book deleted successfully!!"}
    },

    async updateBook(parent,args,ctx,info){

        const book = await ctx.db.query.book({
            where: {id: args.id}
        });

        if(!book) throw new Error("Book Not Found!!"); 

        const publisher = await ctx.db.query.publisher({
            where: {name: args.publisher}
        });
        const type = await ctx.db.query.type({
            where: {name: args.type}
        });
        const category = await ctx.db.query.category({
            where: {name: args.category}
        });

        var tags = args.tags.map((tag)=>{
            return {text: tag}
        });

        var images = args.images.map((image)=>{
            return {src: image}
        })

        await ctx.db.mutation.deleteManyImages({
            where: {book: book}
        });

        await ctx.db.mutation.deleteManyTags({
            where: {book:book}
        });

        const updatedBook = await ctx.db.mutation.updateBook({
            data : {
                title: args.title,
                author: args.author,
                category: {connect: {id: category.id}},
                publisher: {connect: {id: publisher.id}},
                type: {connect: {id: type.id}},
                subject: args.subject,
                edition: args.edition,
                active: true,
                quantity: args.quantity,
                detail: args.detail,
                description: args.description,
                mrp: parseInt(args.mrp),
                slug: args.slug,
                tags : {
                    create : tags
                },
                images : {
                    create: images
                },
                dateTime: new Date()
            },
            where: {id: args.id}
        });

        if(!updatedBook) throw new Error("Book Updation Failed");

        return {message: "Book has been updated Successfully!!"}
    }

    

    

    
}

module.exports = Mutation;