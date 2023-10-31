/* eslint-disable no-unused-expressions */
const express = require('express');
const app = express();
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const htmlpdf = require('html-pdf');
const { Sequelize } = require('sequelize')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
const upload = multer();

app.use(express.json());
app.use(cookieParser())
app.use(cors({ origin: true, credentials: true }))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'client/')));

// log-in system

const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')
dotenv.config()
const secretKey = process.env.TOKENSECRET

const sequelize = new Sequelize('jobs', 'root', '', {host: 'localhost', dialect: 'mysql', retry: { match: [Sequelize.ConnectionError] }, pool: { max: 15, min: 5, idle: 20000, acquire: 30000 }})
sequelize.authenticate().then(
    console.log('User database connection established')
).catch((err) => {
    console.log('There was an unknown error: ' + err)
})

User = require('./models/user.model')(sequelize)

// storage

const directory = path.dirname('');
const parent = path.resolve(directory, '..');
// Ensure that the folder name is correct otherwise you will get file errors and the email won't send
const uploaddir = parent + (path.sep) + 'jobs' + (path.sep);
console.log(uploaddir);

// SQL Server

const mysql = require('mysql');

// These details will need to be filled out for the SQL server in use
const dbConfig = {
    host: '',
    user: '',
    password: '',
    database: 'jobs',
    timezone: 'utc'
};

const connection = mysql.createConnection(dbConfig);
connection.connect(function (err) {
    if (err) { console.log(err); };
    console.log('SQL database is connected');
});

setInterval(function () {
    connection.query('SELECT 1');
}, 5000);

// Log-In functions

// This function makes a user account by refering the API and filling out the details. This was done instead of making a sign-up page for ease. 

// ----------- IMPORTANT -----------------
// Use this to create users and run it as localhost:8090/createAdmin on server in web-browser
// app.get('/createAdmin', async (req, res) => {
//     const email = ''
//     const password = ''
    
//     const salt = await bcrypt.genSalt(10)
//     const hashedPassword = await bcrypt.hash(password, salt)

//     const newUser = await User.create({ email, password: hashedPassword})
// })

let tokenBlacklist = []

app.post('/login', async (req,res) => {
    try {
        const { email, password } = req.body
        const user = await User.findOne({ where: { email }})
        if (!user) {
            return res.status(408).json({ error: 'Invalid username or password '})
        }
        const passwordMatch = await bcrypt.compareSync(password, user.password)
        if (passwordMatch) {
            const token = jwt.sign({ email }, secretKey, {expiresIn : '1h'})
            res.cookie('sessionToken', token, {
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 1200000
            })
            res.cookie('username', email, {
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 1200000
            })
            res.cookie('userid', user.userID, {
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 1200000
            })
            res.status(200).send()
        } else {
            res.status(408).json({ error: 'Invalid username or password' })
        }
    } catch (err) {
        console.error('Error during login:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.get('/signOut', verifyToken, function (req,res) {
    tokenBlacklist.push(req.cookies.sessionToken)
    res.redirect('/index')
})

app.get('/getUsername', function (req, res) {
    const username = req.cookies.username
    res.send({ username })
})

app.get('/getUserID', function (req, res) {
    const userID = req.cookies.userID
    res.send({ userID })
})


function verifyToken(req, res, next) {
    token = req.cookies.sessionToken
    if (!token) {
        res.status(401).send()
    } else if (tokenBlacklist.includes(token)){
        return res.status(401).send('Token is blacklisted')
    } else {
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' })
        }
        req.userID = user.userID
        next()
    })}
}

app.get('/index', function(req, res) {
    const filepath = path.join(__dirname, 'client', 'index.html')
    res.sendFile(filepath)
})


// General

app.post('/newJobSheet', upload.any(), verifyToken,  function (req, resp) {
    const jobID = req.body.jobID;
    const userID = req.cookies.userid;
    const date = req.body.Date;
    const pdfDate = req.body.PDFDATE;
    const clientName = req.body.client;
    const location = req.body.location;
    const ticketReference = req.body.ponumber;
    const days = req.body.days;
    const hours = req.body.hours;
    const engineer1 = req.body.engineer1;
    const engineer2 = req.body.engineer2;
    const engineer3 = req.body.engineer3;
    const engineer4 = req.body.engineer4;
    const files = req.files;

    const fileArray = [];

    const currentDate = new Date();
    const month = currentDate.getUTCMonth();
    const year = currentDate.getUTCFullYear();
    const day = currentDate.getUTCDate();
    const tempDate = '-' + year + '-' + month + '-' + day;

    for (let i = 0; i < files.length; i++) {
        fs.writeFile(uploaddir + 'Receipts' + (path.sep) + files[i].originalname + tempDate + '.pdf', files[i].buffer, function (err) {
            if (err) throw err;
        });
        const y = files[i].originalname + tempDate + '.pdf';
        const q = uploaddir + 'Receipts';
        const filepath = path.join(q, y);
        fileArray.push({ filename: files[i].originalname, path: filepath, contentType: 'application/pdf' });
    }

    let engineers = [];
    engineers.push(engineer1);
    engineers.push(engineer2);
    engineers.push(engineer3);
    engineers.push(engineer4);

    const details = req.body.jobDetails;
    const numberOfLineBreaks = (details.match(/\n/g) || []).length;
    const newHeight = 110 + numberOfLineBreaks * 20 + 12 + 2;

    const mileage = req.body.mileage;
    const food = req.body.food;
    const postage = req.body.postage;
    const parking = req.body.parking;
    const tools = req.body.tools;

    let expenses = [];
    expenses.push(mileage);
    expenses.push(food);
    expenses.push(postage);
    expenses.push(parking);
    expenses.push(tools);

    const equipment1 = req.body.expenses;
    const serialNumber = req.body.serialNumber;
    const costNumber = req.body.costNumber;
    const saleNumber = req.body.saleNumber;

    let equipment = [];

    for (let i = 0; i < equipment1.length; i++) {
        if (!(equipment1[i] === '')) {
            if (saleNumber[i] === 0) {
                saleNumber[i] = 'NPQ';
            }
        }
    }

    equipment.push(equipment1);
    equipment.push(serialNumber);
    equipment.push(costNumber);
    equipment.push(saleNumber);

    expenses = JSON.stringify(expenses);
    equipment = JSON.stringify(equipment);
    engineers = JSON.stringify(engineers);

    const invoiceNumber = req.body.invoiceNumber;

    const newDate = new Date(date);
    connection.query('INSERT INTO jobs (Date, userID, Client, ponumber, Days, Hours, Engineers, JobDetails, Expenses, Equipment, InvoiceNumber) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [newDate, userID,clientName, ticketReference, days, hours, engineers, details, expenses, equipment, invoiceNumber], function (err) {
        if (err) throw err;
    });

    equipment = JSON.parse(equipment);
    engineers = JSON.parse(engineers);



    let htmlForEmail = `<html><title>Job Sheet Print</title><body><h2 style='display: inline-block;'>Job Sheets</h2>
    <h2 style='display: inline-block; float: right;'>Job Number - ${jobID}</h2>
    <h3 style="display: block; font-size: 2rem;">${pdfDate}</h3>
    <h3 style="font-size: 2rem; display: block;">${clientName}</h3>
    <ul>
    <li>Location - ${location}</li>
    <li>Engineers:</li>`;

    for (let i = 0; i < engineers.length; i++) {
        if (engineers[i] === '') {
            break;
        }
        htmlForEmail += `<li><strong>${engineers[i]}</strong></li>`;
    }

    htmlForEmail += `
    </ul>
    <br>
    <ul>
    <li>Days - ${days}</li>
    <li>Hours - ${hours}</li>
    </ul>
    <br>
    <ul style="list-style: none">
    <li>Details:</li>
    <li><textarea style="height: ${newHeight}px; border: none; width: 600px">${details}</textarea></li>
    </ul>
    <ul>
    </ul>
    <br>
    <ul>
    </ul>
    <br>
    <ul>
    <li>Equipment:</li>`;

    for (let i = 0; i < equipment[0].length; i++) {
        if (equipment[0][i] === '') {
            break;
        }
        htmlForEmail += `<li>Name: ${equipment[0][i]} | Serial Number: ${equipment[1][i]} | Cost Number: ${equipment[2][i]} | Sale Number: ${equipment[3][i]} </li>`
    }

    const mileage2 = (mileage * 0.3).toFixed(2);

    htmlForEmail += `<li>Total Cost: ${req.body.totalCost}</li>
    <li>Total Sale: ${req.body.totalSale}</li>
    <ul>
    <br>
    <ul>
    <li>Expenses:</li>
    <li>Mileage: £${mileage2} (${mileage} miles)</li>
    <li>Food: £${food}</li>
    <li>Postage: £${postage}</li>
    <li>Parking: £${parking}</li>
    <li>Tools: £${tools}</li>
    <li>Total Expenses: ${req.body.totalExpenses}</li>
    </ul>    
    `;

    const options = {
        format: 'A4'
    };

    htmlpdf.create(htmlForEmail, options).toFile('JobSheet1.pdf', function(err) {
        if (err) {
            resp.send(err);
        } else {
            jobSheetFilePath = uploaddir + 'JobSheet1.pdf',
            fileArray.push({ filename: 'JobSheet: ' + jobID + '.pdf', path: jobSheetFilePath, contentType: 'application/pdf' })
            const emailFunction = () => {
                const transporter = nodemailer.createTransport({
                    host: 'smtp.office365.com', 
                    port: 587,
                    auth: {
                        user: '',
                        pass: ''
                    },
                    tls: {rejectUnauthorized: false,},
                })
        
                const mailOptions = {
                    from: '',
                    to: '',
                    subject: 'Job Sheet: ' + jobID,
                    text: 'Please find attached the job sheet and receipt(s) for Job Number ' + jobID,
                    attachments: fileArray
                }
                transporter.sendMail(mailOptions, function (error) {
                    if (error) {
                        console.log(error)
                        fs.unlink(jobSheetFilePath, (err) => {
                            if (err) throw err;
                        })
                        resp.send(error)
                    } else {
                        resp.sendStatus(200)
                        fs.unlink(jobSheetFilePath, (err) => {
                            if (err) throw err;
                        })
                    }
                })
            }
            emailFunction();
        }
    })


    


})

app.post('/loadAddress', verifyToken, function (req, resp) {
    const clientName = req.body.client
    connection.query('SELECT Location from clients where Name = ?', [clientName], function (err, result) {
        if (err) throw err;
        resp.send(JSON.stringify(result))
    })
})

app.get('/loadEngineerNames', verifyToken, function (req, resp) {
    connection.query('SELECT ID, Name from engineers ORDER BY Name ASC', function (err, result) {
        if (err) throw err;
        const myArray = Array();
        for (i=0;i<result.length;i++) {
            myArray.push(result[i]['Name'])
        }
        resp.send(myArray);
    })
})

app.get('/loadClientNames', verifyToken, function (req, resp) {
    connection.query('SELECT Name from clients ORDER BY Name ASC', function (err, result) {
        if (err) throw err;
        resp.send(result)
    })
})

app.post('/searchID', verifyToken,function (req, resp) {
    // query is done via localhost/searchID46 (there is no : used)
    const ID = req.body.ID
    connection.query('SELECT * from jobs where ID = ?', [ID], function (err, result) {
        resp.send(JSON.stringify(result))
    })
})

app.post('/submitChange', verifyToken, function (req, resp) {
    jobId = req.body.ID
    userID = req.cookies.userid
    date = req.body.Date
    client = req.body.client
    ponumber = req.body.trn
    days = req.body.days
    hours = req.body.hours
    engineer = req.body.engineers
    equipment = req.body.equipment
    details = req.body.details
    expenses = req.body.expenses
    invoiceNumber = req.body.invoiceNumber

    // need to make query for editing equipment

    connection.query('UPDATE jobs SET Date = ?, userID = ?,Client = ?, ponumber = ?, Days = ?, Hours = ?, Engineers = ?, JobDetails = ?, Expenses = ?, Equipment = ?, InvoiceNumber = ? WHERE ID = ?', [date, userID, client, ponumber, days, hours, JSON.stringify(engineer), details, JSON.stringify(expenses), JSON.stringify(equipment),invoiceNumber, jobId], function (err) {
        if (err) throw err;
        resp.sendStatus(200)
    })

    
})

app.get('/loadNewID', verifyToken,function (req, resp) {
    connection.query('SELECT ID from jobs ORDER BY ID DESC', function (err, result) {
        if (err) throw err;
        const x = result[0]
        const newID = String(x['ID'] + 1)
        resp.send(newID)
    })
})

app.get('/loadIDs', verifyToken,function (req,resp) {
    connection.query('SELECT ID FROM jobs ORDER BY ID DESC', function (err, result) {
        if (err) throw err;
        resp.send(result)
    })
})

// Search area

app.post('/loadIDDate', verifyToken, function (req, resp) {
    const date1 = req.body.date1
    const date2 = req.body.date2
    connection.query('SELECT ID from jobs WHERE CAST(Date as Date) BETWEEN ? AND ?', [date1, date2], function (err, result) {
        if (err) throw err;
        resp.send(JSON.stringify(result))
    })
})

app.post('/loadIDClient', verifyToken, function (req, resp) {
    const clientName = req.body.clientName
    connection.query('SELECT ID FROM jobs WHERE client = ? ORDER BY ID DESC', [clientName], function (err, result) {
        if (err) throw err;
        resp.send(JSON.stringify(result))
    })
})

app.post('/loadIDEngineer', verifyToken, function (req, resp) {
    const engineerName = req.body.engineerName
    connection.query('SELECT ID, Engineers FROM jobs', function (err, result) {
        if (err) throw err;
        const x = result
        const Idkeys = Object.keys(x)
        const mainArray = Array()
        Idkeys.forEach(function (y) {
            mainArray.push(x[y])
        })
        outputArray = Array()
        for (i=0;i<mainArray.length;i++) {
            let engineerName2 = ''
            for (y=1;y<mainArray[i]['Engineers'].length;y++) {
                if (y == 1) {
                } else if (mainArray[i]['Engineers'][y] == '"') {
                    if (engineerName2 == engineerName) {
                        outputArray.push(mainArray[i]['ID'])
                    }
                } else {
                    engineerName2 += mainArray[i]['Engineers'][y]
                }
            }
            engineerName2 = ''
        }
        resp.send(outputArray)
    })
})

app.post('/loadIDEngineerTime', verifyToken, function (req,resp) {
    const engineerName = req.body.engineer
    const date1 = req.body.date1
    const date2 = req.body.date2
    let totalDays = 0
    let totalHours = 0
    const outputArray = Array()
    connection.query('SELECT ID, Engineers, Hours, Days FROM jobs where CAST(Date as Date) BETWEEN ? AND ?', [date1, date2], function (err, result) {
        if (err) throw err;
        const x = result
        const engineerKeys = Object.keys(x)
        for (i=0;i<engineerKeys.length;i++) {
            const tempEngineerArray = JSON.parse(x[i]['Engineers'])
            for (y=0;y<tempEngineerArray.length;y++) {
                const currentPick = tempEngineerArray[y]
                if (currentPick == engineerName) {
                    totalDays += x[i]['Days']
                    totalHours += x[i]['Hours']
                }
            }
        }
        outputArray.push(totalHours)
        outputArray.push(totalDays)
        resp.send(outputArray)
    })
})

// System administration

app.get('/loadClientTable', verifyToken, function (req, resp) {
    connection.query('SELECT * FROM clients', function (err, result) {
        if (err) throw err;
        resp.send(result)
    })
})

app.get('/loadEngineerTable', verifyToken, function (req,resp) {
    connection.query('SELECT * from engineers', function (err, result) {
        if (err) throw err;
        resp.send(result)
    })
})

app.post('/addEngineer', verifyToken, function (req, resp) {
    const engineerName = req.body.engineerName
    connection.query('INSERT INTO engineers (Name) VALUES (?)', [engineerName], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})

app.post('/deleteEngineer', verifyToken, function (req, resp) {
    const engineer = req.body.engineerName;
    connection.query('DELETE FROM engineers WHERE Name = ?', [engineer], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})

app.post('/editEngineer', verifyToken,function (req, resp) {
    const engineer = req.body.oldName;
    const newName = req.body.newName;
    connection.query('UPDATE engineers set Name = ? WHERE Name = ?', [newName, engineer], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})

app.post('/addClient', verifyToken, function (req, resp) {
    const clientName = req.body.name;
    const clientAddress = req.body.address;
    connection.query('INSERT INTO clients (Name, Location) VALUES (?,?)', [clientName, clientAddress], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})

app.post('/deleteClient', verifyToken, function (req, resp) {
    const clientName = req.body.clientName;
    connection.query('DELETE FROM clients WHERE Name = ?', [clientName], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})

app.post('/editClientName', verifyToken, function (req, resp) {
    const clientName = req.body.old;
    const newName = req.body.new;
    connection.query('UPDATE clients set Name = ? WHERE Name = ?', [newName, clientName], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})  

app.post('/editClientAddress', verifyToken, function (req, resp) {
    const clientName = req.body.clientName;
    const newAddress = req.body.clientAddress;
    connection.query('UPDATE clients set Location = ? WHERE Name = ?', [newAddress, clientName], function (err) {
        if (err) throw err;
        resp.send(200)
    })
})  

module.exports = app