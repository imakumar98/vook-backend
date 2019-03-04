

    //Sign Up resolver
     async signup(parent,args,ctx,info){
        //Lower the email address
        args.email = args.email.toLowerCase();
        //Hash the password
        args.password = await bcrypt.hash(args.password,10);

        //Create the user
        const user = await ctx.db.mutation.createUser({
            data: {
               ...args,
               password : args.password,
               permissions: {set: ['USER']}
            }
        },info);

        //Create JWT token 
        const token = jwt.sign({userId: user.id},process.env.TOKEN_SALT);
        //We set the jwt as a cookie on the response
        ctx.response.cookie('token',token,{
            httpOnly: true,
            maxAge: 1000 * 60 * 24 * 365,//1 year
        });
        //Finally return user to browser
        return user;


     },

     async signin(parent,{email,password},ctx,info){
        //1. Check if there is a user with that email
        const user = await ctx.db.query.user({where: {email}});
        if(!user){
            throw new Error(`No such user found for email ${email}`);
        }
        //2. Check if their passsword is correct
        const valid = await bcrypt.compare(password,user.password);
        if(!valid){
            throw new Error('Invalid Password');
        }
        //3. Generate the JWT token
        const token = jwt.sign({userId: user.id},process.env.TOKEN_SALT);
        //4. Set the cooki with the token
        ctx.response.cookie('token',token,{
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365,//1 year
        });
        //5. Return the User
        return user;

     },
    signout(parent,args,ctx,info){
         ctx.response.clearCookie('token');
         return {message:  'Goodbye!'};
     },

    async requestReset(parent,args,ctx,info){
        //1. Check if user is real
        const user = await ctx.db.query.user({where: {email:args.email}});
        if(!user){
            throw new Error(`No such user found for email ${args.email}`);
        }

        //2. Set a reset token and expiry on that user
        const randomBytesPromisified = promisify(randomBytes);
        const resetToken = (await randomBytesPromisified(20)).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; //1 hour from now
        const res = await ctx.db.mutation.updateUser({
            where : {email:args.email},
            data: {resetToken,resetTokenExpiry}
        });
        
        //3. Email them that reset token
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
        })
        if(!response.data.success){
            throw new Error("Something went wrong");
        }

        //4. Return the message 
        return {message : 'Thanks!'};
        
    },

    async resetPassword(parent,args,ctx,info){
        //1. Check if the password match
        if(args.password !== args.confirmPassword){
            
            throw new Error("Passwords dont match");
        }
        //2. Check if its a legit reset token
        //3. Check if its  expired
        const [user] = await ctx.db.query.users({
            where: {
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000
            }
        });
        if(!user){
            throw new Error("This token is either invalid or expired!");
        }
        
        //4. Hash new password
        const password = await bcrypt.hash(args.password,10) ;
        //5. Save the new password to the user and remove old resetToken fields
        const updatedUser = await ctx.db.mutation.updateUser({
            where: {email: user.email},
            data: {
                password,
                resetToken: null,
                resetTokenExpiry: null
            }
        })
        //6. Generate  JWT
        const token = jwt.sign({userId: updatedUser.id},process.env.TOKEN_SALT);
        //7. Set the jwt cookie
        ctx.response.cookie('token',token,{
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365
        })
        //8. Return the new user
        return updatedUser;
        
    },

    async addToCart(parent,args,ctx,info){
        //1. Make sure they are signed In
        const {userId} = ctx.request; 
        if(!userId){
            throw new Error("You must be signed in soon");
        }
        //2. Query the users current cart
        const [existingCartProduct] = await ctx.db.query.cartProducts({
            where: {
                user: {id: userId},
                product: {id: args.id}
            }
        });
        //3. Check if that product is already in their cart and increment by 1 if it is according to type
        if(existingCartProduct){
            if(args.type=='IncrementByOne'){
                return ctx.db.mutation.updateCartProduct({
                    where: {id: existingCartProduct.id},
                    data: {quantity: existingCartProduct.quantity + 1},
                },info)
            }else if(args.type=='UpdateQuantity'){
                
                return ctx.db.mutation.updateCartProduct({
                    where: {id: existingCartProduct.id},
                    data: {quantity: parseInt(args.quantity)},
                },info)
            }
            
            
        }
        
        //4. If its not, create a fresh CartProduct for that user
        return ctx.db.mutation.createCartProduct({
            data: {
                user: {
                    connect: {id: userId},  
                },
                product: {
                    connect: {
                        id: args.id
                    }
                },
                quantity: args.quantity
            }
        },info)
    },

    async removeFromCart(parent,args,ctx,info){
        //1. Find the cart product
        
        const cartProduct = await ctx.db.query.cartProduct({
            where: {
                id: args.id
            },
        },
            `{id, user{ id }}`
        );
        // //1.5 Make sure we found an product
        if(!cartProduct){
            throw new Error("No Book Found!");
        }
        //2. Make sure they own that cart product
        if(cartProduct.user.id !==ctx.request.userId){
            throw new Error('Cheatin huhh');
        }
        //3. Delete that cart product
        return ctx.db.mutation.deleteCartProduct({
            where: {id: args.id},
        },info);
    },

    async createOrder(parent,args,ctx,info){
        //1. Query the current user and make sure they are signed in
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
                    product {
                        id
                        title
                        author
                        publisher
                        mrp 
                        discount
                        images {
                            src
                        }
                    }
                }
            }`
        );

        
        //2. Check for all required field provided(Validation)
        if(!args.number){
            throw new Error("Phone number field is required!! ");
        }
        if(args.number.length!==10){
            throw new Error("Phone number must be 10-digit value!!");
        }
        if(!args.streetAddress){
            throw new Error("Street Address field is required!!");
        }
        if(!args.city){
            throw new Error("City field is required!!");
        }
        if(!args.state){
            throw new Error("State field is required!!");
        }
        if(!args.postalCode){
            throw new Error("Postal Code/Zip field is required!!");
        }
        
        //3. Update User Address and Email if User Selected Set It Default
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

        //4. Validate Postal Code
        const postalCode = await ctx.db.query.postalCode({where: {code: String(args.postalCode)}});
        if(!postalCode) throw new Error(`Sorry!! But Vook Services Are Not Available At ${args.postalCode}`);
        

        
        //5. Recalculate the total price for assurance
        const subTotal = calcTotalPrice(user.cart);
        var total = subTotal;
        
        if(args.isVookBalanceUsed){
            total = subTotal - user.walletBalance
        }
        if(args.couponCode){
            //SOLVE FOR COUPON CODE
            var couponCode = args.couponCode;
        }

        //6. Convert the cartProducts to orderProducts
        const orderItems = user.cart.map(cartItem=>{
            const orderItem = {
                title: cartItem.product.title,
                author: cartItem.product.author,
                publisher: cartItem.product.publisher,
                price: Math.round(cartItem.product.mrp - (cartItem.product.mrp * (cartItem.product.discount/100))),
                image: cartItem.product.images[0].src,
                quantity: cartItem.quantity,
                user: { connect: {id: userId} }
            }
            delete orderItem.id;
            return orderItem;
        })

        //7. Create the order

        //7.1 Create Readable Order ID
        var lastOrder = await ctx.db.query.orders({last:1});
        if(lastOrder.length==0){
            var orderId = 2019500;
        }else{
            var lastOrderId = lastOrder[0].orderId;
            var orderId = lastOrderId + 1;
        }
        
        //7.2 Save the Order in Database
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
                status: 'PROCESSING',
                products: {create: orderItems},
                user: {connect: {id:userId}},
               orderId: orderId
            }
        },info)


        //8. Clean up - Clear the User Cart, Delete Cart Products
        const cartProductIds = user.cart.map(cartItem=>cartItem.id);
        await ctx.db.mutation.deleteManyCartProducts({where: {
            id_in: cartProductIds
        }})

        //9. Create Order Invoice




        //10. Send Email/SMS for successfull order creation With Order Invoice as attachment(TO CUSTOMER)

        //10.1 Send Mail Confirmation
        console.log("Confirmation mail sent");

        //10.2 Send SMS Confirmation
        console.log("SMS for Order Confirmation Sent");
        
        

        //11 Send Email for order generation(TO ME)
        const object = getOrderProductObjectForMail(order.products);
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
        if(!args.firstName){
            throw new Error("First Name field is Required!!");
        }
        if(!args.lastName){
            throw new Error("Last Name field is Required!!");
        }
        if(!args.email){
            throw new Error("Email field is Required!!");
        }
        if(!args.number){
            throw new Error("Contact number field is Required!!");
        }
        if(!args.message){
            throw new Error("Message field is Required!!");
        }

        //Email information to admin
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
        if(!response.data.success){
            throw new Error("Something went wrong");
        }
        return {message : 'Your query has been submitted successfully!! We will contact you very soon.'};
    },

    async createPostalCode(parent,args,ctx,info){
        const code = await ctx.db.query.postalCodes({
            where: {
                code: args.code
            }
        });

        if(code.length>0){
            throw new Error(args.code + " already exist");
        }

        return ctx.db.mutation.createPostalCode({
            data: {
                code: args.code
            }
        },info);

    },