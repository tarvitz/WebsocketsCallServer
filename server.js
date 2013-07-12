var debug = true;
var log = false;

var log = (debug) ? console.log.bind(console) : function(){};
var io = require('socket.io').listen(8900, {log: false});
var usernames = {};
/*helpers*/

function getattr(field){
    return function(item){
        return item[field];
    }
}
function getGiven(field, value){
    return function(item){
        if (item[field] == value)
            return item
    }
}

function getClient(client, room){
    return {
        username: client.username,
        uid: client.uid,
        state: client.state,
        socketid: client.id,
    }
}

function reduceUndefined(item, prev){
    if (prev)
        return prev;
    if (item)
        return item
}

io.sockets.on('connection', function(client){
    //client.emit('news', {test: 'data'});
    function getClients(room){
        var clients = [];
        log('getClients for room: ', room);
        for (klient in io.sockets.clients(room)){
            _client = io.sockets.clients(room)[klient];
            clients.push({
                'username': _client.username,
                'uid': _client.uid,
                'socketid': _client.id,
                'state': 'free',
            });
        }
        return clients;
    }

    function checkUserPresence(uid){
        uids = getClients().map(getattr('uid'))
        count = 0;
        for (var i = 0; i < uids.length; i++){
            if (uids[i] === uid){
                count++;
                if (count > 1) return true
            }
        }
        return false;
    }

    function getRoomUsers(room){
        var clients = [];
        if (room){
            io.sockets.clients(room).map(function(klient){
                clients = clients.concat([{
                    uid: klient.uid,
                    username: klient.username,
                    socketid: klient.id
                }]);
            });
        }
        return clients;
    }

    function getUserList(socketid, rooms){
        var user_list = [];
        if (rooms){
            rooms.map(function(room){
                getClients(room).map(function(klient){
                    if (user_list.map(getattr('uid')).indexOf(klient.uid) == -1){
                        user_list = user_list.concat([klient]);
                    }
                });
            });
        }
        return user_list;
    }

    function updateUserList(){
        io.sockets.clients().map(function(klient){
            var _clients = [];
            roomClients = io.sockets.manager.roomClients[klient.id];
            for (node in roomClients){
                room = node.replace('/', '');
                getRoomUsers(room).map(function(user){
                    if (_clients.map(getattr('uid')).indexOf(user.uid) == -1){
                        _clients = _clients.concat([user]);
                    }
                });
            }
            if (debug) log('updating clients: ', _clients);
            klient.emit('updateUserList', _clients);
        });
    }

    //sends signal to everyone, includes signal initiator
    function sendToAll(){
        for (klient in io.sockets.clients()){
            _client = io.sockets.clients()[klient];
            _client.emit.apply(_client, arguments);
        }
    }

    /*
    // sends signal to everyone, excepts signal initiator
    function sendToEveryone(){
        //clients = io.sockets.clients();
        for (klient in io.sockets.clients()){
            if (io.sockets.clients()[klient] != client){
                _client = io.sockets.clients()[klient];
                _client.emit.apply(_client, arguments);
            }
        }
    }
    */

    client.on('updateUser', function(){
        // send only the rooms there client stands for now
        io.sockets.manager.roomClients[client.id].map(function(room){
            //sendToAll('updateUser', getClient(client));
            io.sockets.in(room).emit('updateUser', getClient(client, room));
        })
    });

    client.on('getUserList', function(socketid, rooms){
        var clients = getUserList(socketid, rooms);
        if (clients){
            client.emit('updateUserList', clients);
        }
    });

    client.on('registeruser', function(data){
        // check if user duplicates
        client.username = data.username;
        client.uid = data.uid;
        client.state = 'free'; //free|busy

        if (debug) log("registeruser: ", usernames[data.socketid]);
        alreadyLogged = checkUserPresence(client.uid);
        if (debug) log('check if ' + client.username + ' is logged: ', alreadyLogged);
        if (alreadyLogged){
            client.emit('disconnect', 'such user is logged already');
        }
        // joinning rooms
        if (data.rooms){
            data.rooms.map(function(room){
                if (debug) log(client.id, " joins ", room);
                client.join(room);
            });
        }
        // sending to each users its user-seeing list
        updateUserList();

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
        setTimeout(function(){
            updateUserList();
        }, 300);
        removeUser(client.id);
    });

    client.on('ping', function(){
        sendToAll('pong', 'pong');
    });

    //clients.on('sentdo', function(to, type, payload) // old declaration
    client.on('sendto', function(){
        // 1 - to
        // 2 - type
        // 3 - arguments
        if (arguments.length < 2){
            log('error sendto arguments amount lesser than 2, please fix emit call');
        }

        // sending signal to somebody is receiving that signal from the sender
        // so receiving proto should use ``from`` for better use understand
        to = from = arguments[0];
        type = arguments[1];
        args = Array.apply(Array, arguments);
        //from = to; //to becomes from
        //payload = (typeof payload == 'undefined') ? {} : payload;
        log('get sendto: ', from, type, args);
        //clients = io.sockets.clients();

        if (io.sockets.clients().map(getattr('id')).indexOf(to) > -1){
            log('emitting to: ', to);
            klient = io.sockets.clients().map(getGiven('id', to)).reduce(reduceUndefined);
            if (klient){
                //klient.emit('receive', type, from, payload);
                args = ['receive', type, from].concat(args.splice(2));
                klient.emit.apply(klient, args);
            } else {
                log('ERROR occured, no such client "' + to + '" found');
            }
        }
    });

    client.on('setbusy', function(state){
        client.busy = state;
        client.emit('setbusy', state);
    });
});
