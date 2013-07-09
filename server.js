var debug = true;

var log = (debug) ? console.log.bind(console) : function(){};
var io = require('socket.io').listen(8900);
var usernames = {};

io.sockets.on('connection', function(client){
    //client.emit('news', {test: 'data'});
    client.on('getUsers', function(fromid){
        log('getUsers: ', fromid);
        log(io.sockets.clients());
        clients = [];
        for (klient in io.sockets.clients()){
            log(io.sockets.clients()[klient].username);
            clients.push(io.sockets.clients()[klient]['id']);
        }
        client.emit('getUsers', clients);
    });

    client.on('registeruser', function(data){
        client.username = data.username;
        usernames[data.socketid] = data.username;
        log(usernames);
    });
    client.on('unregisteruser', removeUser);
    
    function removeUser(id){
        if (id in usernames) {
            delete usernames[id]
        }
        log(usernames);   
    }

    client.on('disconnect', function(){
        log('disconnect: ', client.id);
        removeUser(client.id);
    }); // client disconnects
});
