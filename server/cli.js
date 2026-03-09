require('dotenv').config();

const command = process.argv[2];
const PORT = process.env.PORT || 3001;


async function callEndpoint(path) {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': process.env.ADMIN_TOKEN
    }
  });

  const data = await res.json();
  console.log(data);
}

async function f(command) {
    switch (command) {
        case 'start':
            await callEndpoint('/admin/start_collection');
            break;

        //   case 'stop':
        //     await callEndpoint('/admin/stop');
        //     break;

        default:
            console.log('Only "start" command is supported. Usage: node cli.js start');
    }
}
f(command);