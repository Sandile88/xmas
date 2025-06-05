import React, { useContext, useState, useEffect } from "react";
import { AiFillPlayCircle } from "react-icons/ai";
import { SiEthereum } from "react-icons/si";
import { BsInfoCircle } from "react-icons/bs";
import { FaUserShield, FaLock, FaWifi, FaShieldAlt, FaDollarSign, FaBook } from "react-icons/fa";
import fs from "fs"; 

//import { TransactionContext } from "../context/TransactionContext";
import { shortenAddress } from "../utils/shortenAddress";
import { Loader } from ".";
import $u from '../utils/$u.js';
import { ethers } from "ethers";
import wc from "../circuit/witness_calculator.js";
import tornadoJSON from "../json/Tornado.json";
import UzarTokenABI from "../json/abizar.json";

import QRCode from "qrcode";
// import QrReader from "react-qr-reader";
import StepsProgress from "./StepsProgress.jsx";
import Modal from "./Modal.jsx";


const UZAR_TOKEN_ADDRESS = "0xBf715EB900bbEAa2C7e136E9c2A0C6AED93E8aeb"; // lisk sepolia // '0x5315E2c1B45f58c468dE6a31eBF8ae9f06790F32'; sepolia eth 11155111
const CONTRACT_ADDRESS = "0x46c321234896293Fae383C9768b338902db6B20E"; // lisk sepolia // "0x2836692157Dd96cb74870a12210273983144Cf3C"; sepolia eth
const tornadoAddress = "0x46c321234896293Fae383C9768b338902db6B20E"; // lisk sepolia  // "0x2836692157Dd96cb74870a12210273983144Cf3C"; sepolia  eth
const tornadoABI = tornadoJSON.abi;
const tornadoInterface = new ethers.utils.Interface(tornadoABI);
const ButtonState = { Normal: 0, Loading: 1, Disabled: 2 };
const companyCommonStyles = "bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl transition-all duration-300 p-4 flex items-center justify-center flex-col h-32";

const Input = ({ placeholder, name, type, value, handleChange }) => (
  <input
    placeholder={placeholder}
    type={type}
    step="0.0001"
    value={value}
    onChange={(e) => handleChange(e, name)}
    className="my-2 w-full rounded-sm p-2 outline-none bg-transparent  border-none text-sm white-glassmorphism"
  />
);



const Welcome = () => {
  const [provider, setProvider] = useState(null);
  const [accounts, setAccount] = useState(null);
  const [uzarBalance, setUzarBalance] = useState("0");
  const [allowance, setAllowance] = useState("0");
  const [uzarToken, setUzarToken] = useState(null);
  const [contract, setContract] = useState(null);



  const [account, updateAccount] = useState(null);
  const [proofElements, updateProofElements] = useState(null);
  const [proofStringEl, updateProofStringEl] = useState(null);
  const [textArea, updateTextArea] = useState(null);

  // interface states
  const [section, updateSection] = useState("Deposit");
  const [displayCopiedMessage, updateDisplayCopiedMessage] = useState(false);
  const [withdrawalSuccessful, updateWithdrawalSuccessful] = useState(false);
  const [metamaskButtonState, updateMetamaskButtonState] = useState(ButtonState.Normal);
  const [depositButtonState, updateDepositButtonState] = useState(ButtonState.Normal);
  const [withdrawButtonState, updateWithdrawButtonState] = useState(ButtonState.Normal);

  const [qrCodeURL, setQRCodeURL] = useState("");
  const [isScanned, setIsScanned] = useState(false); 



  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum !== "undefined") {
        const _provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(_provider);

        try {
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const signer = _provider.getSigner();
          const userAccount = await signer.getAddress();
          setAccount(userAccount);

          const _contract = new ethers.Contract(CONTRACT_ADDRESS, tornadoABI, signer);
          setContract(_contract);

          const _uzarToken = new ethers.Contract(UZAR_TOKEN_ADDRESS, UzarTokenABI, signer);
          setUzarToken(_uzarToken);

          fetchBalance(_uzarToken, _contract, userAccount);
        } catch (err) {
          console.error("Error connecting to MetaMask:", err);
        }
      } else {
        alert("Please install MetaMask to use this app");
      }
    };

    init();
  }, []);

  const fetchBalance = async (uzarToken, contract, userAccount) => {
    try {
      const balance = await uzarToken.balanceOf(userAccount);
      setUzarBalance(ethers.utils.formatEther(balance));

      const _allowance = await uzarToken.allowance(userAccount, CONTRACT_ADDRESS);
      setAllowance(ethers.utils.formatEther(_allowance));
    } catch (err) {
      console.error("Error fetching UZAR balance or allowance:", err);
    }
  };

  const approveUzar = async () => {
    try {
      const amountToApprove = ethers.utils.parseEther("1000000"); // Amount to approve
      const tx = await uzarToken.approve(CONTRACT_ADDRESS, amountToApprove);
      await tx.wait(); // Wait for the transaction to be mined
      alert("UZAR approved successfully");
      fetchBalance(uzarToken, contract, account); // Refresh balance and allowance
    } catch (err) {
      console.error("Error approving UZAR:", err);
    }
  };
  


  const connectMetamask = async () => {
    try{
        updateMetamaskButtonState(ButtonState.Disabled);
        if(!window.ethereum){
            alert("Please install Metamask to use this app.");
            throw "no-metamask";
        }

        var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        var chainId = window.ethereum.networkVersion;

        // if(chainId != "11155111"){
        //     alert("Please switch to Sepolia Testnet");
        //     throw "wrong-chain";
        // }

        var activeAccount = accounts[0];
        var balance = await window.ethereum.request({ method: "eth_getBalance", params: [activeAccount, "latest"] });
        balance = $u.moveDecimalLeft(ethers.BigNumber.from(balance).toString(), 18);

        var newAccountState = {
            chainId: chainId,
            address: activeAccount,
            balance: balance
        };
        updateAccount(newAccountState);
    }catch(e){
        console.log(e);
    }

    updateMetamaskButtonState(ButtonState.Normal);
  };

  const depositEther = async (amount) => {
    updateDepositButtonState(ButtonState.Disabled);
    try {
      const secret = ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString();
      const nullifier = ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString();
  
      const input = {
        secret: $u.BN256ToBin(secret).split(""),
        nullifier: $u.BN256ToBin(nullifier).split("")
      };
      console.log("Proof Input:", input);
  
      const res = await fetch("/deposit.wasm");
      const buffer = await res.arrayBuffer();
      const depositWC = await wc(buffer);
  
      const r = await depositWC.calculateWitness(input, 0);
      const commitment = r[1];
      const nullifierHash = r[2];
  
      //const { instance } = await loadWasm();
  
      const tx = {
        to: tornadoAddress,
        from: account.address,
        data: tornadoInterface.encodeFunctionData("deposit", [commitment]),
        maxFeePerGas: "10000000",
      };
  
      
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
  
      console.log("Transaction sent. Hash:", txHash);
  
      // Wait for receipt
      let receipt = null;
      while (!receipt) {
        receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });
  
        if (!receipt) {
          console.log("Waiting for the transaction receipt...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
  
      console.log("Transaction receipt received:", receipt);
  
      
      if (!receipt.logs || receipt.logs.length === 0) {
        throw new Error("No logs found in the transaction receipt.");
      }
  
      const log = receipt.logs[2];
      const decodeData = tornadoInterface.decodeEventLog("Deposit", log.data, log.topics);
      console.log("Decoded Event Data:", JSON.stringify(decodeData));

      const proofElements = {
        root: $u.BNToDecimal(decodeData.root),
        nullifierHash: `${nullifierHash}`,
        secret: secret,
        nullifier: nullifier,
        commitment: `${commitment}`,
        hashPairings: decodeData.hashPairings.map((n) => $u.BNToDecimal(n)),
        hashDirection: decodeData.pairDirection,
        txHash: txHash,
      };
  
      console.log("Proof Elements:", proofElements);
      updateProofElements(btoa(JSON.stringify(proofElements)));
      

      try {
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, (JSON.stringify(proofInput)), {
          // await QRCode.toCanvas(canvas, btoa(JSON.stringify(proofElements)), {
          errorCorrectionLevel: "L", 
          width: 300, 
        });

        const ctx = canvas.getContext("2d");

        
        const text = "20";
        ctx.font = "bold 40px Arial"; 
        ctx.fillStyle = "green"; 
        const textWidth = ctx.measureText(text).width;

        
        ctx.fillText(
          text,
          (canvas.width - textWidth) / 2,
          canvas.height / 2 + 10 
        );

       
        const qrCodeWithAmountURL = canvas.toDataURL();
        setQRCodeURL(qrCodeWithAmountURL);
      } catch (error) {
        console.error("Error generating QR Code with amount:", error);
      }
  
      

      
    } catch (e) {
      console.error("Error in depositEther:", e);
    } finally {
      updateDepositButtonState(ButtonState.Normal);
    }
  };
  


  const copyProof = () => {
      if(!!proofStringEl){
          flashCopiedMessage();
          navigator.clipboard.writeText(proofStringEl.innerHTML);
      }  
  };

  const withdraw = async () => {
    updateWithdrawButtonState(ButtonState.Disabled);

    if(!textArea || !textArea.value){ alert("Please input the proof of deposit string."); }

    try{
        const proofString = textArea.value;
        const proofElements = JSON.parse(atob(proofString));
        console.log("Proof Elements:",proofElements);

        receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [proofElements.txHash] });
        if(!receipt){ throw "empty-receipt"; }

        const log = receipt.logs[2];
        const decodedData = tornadoInterface.decodeEventLog("Deposit", log.data, log.topics);

        const SnarkJS = window['snarkjs'];

        const proofInput = {
            "root": $u.BNToDecimal(decodedData.root),
            "nullifierHash": proofElements.nullifierHash,
            "recipient": $u.BNToDecimal(account.address),
            "secret": $u.BN256ToBin(proofElements.secret).split(""),
            "nullifier": $u.BN256ToBin(proofElements.nullifier).split(""),
            "hashPairings": decodedData.hashPairings.map((n) => ($u.BNToDecimal(n))),
            "hashDirections": decodedData.pairDirection
        };

        console.log("final proof",proofInput)

        const { proof, publicSignals } = await SnarkJS.groth16.fullProve(proofInput, "/withdraw.wasm", "/setup_final.zkey");

        const callInputs = [
            proof.pi_a.slice(0, 2).map($u.BN256ToHex),
            proof.pi_b.slice(0, 2).map((row) => ($u.reverseCoordinate(row.map($u.BN256ToHex)))),
            proof.pi_c.slice(0, 2).map($u.BN256ToHex),
            publicSignals.slice(0, 2).map($u.BN256ToHex)
        ];

        const callData = tornadoInterface.encodeFunctionData("withdraw", callInputs);
        const tx = {
            to: tornadoAddress,
            from: account.address,
            data: callData
        };
        const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });

        var receipt;
        while(!receipt){
            receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            await new Promise((resolve, reject) => { setTimeout(resolve, 1000); });
        }

        if(!!receipt){ updateWithdrawalSuccessful(true); }
    }catch(e){
        console.log(e);
    }

    updateWithdrawButtonState(ButtonState.Normal);
  };



  const tester1 = async () => {
    updateWithdrawButtonState(ButtonState.Disabled);

    if(!textArea || !textArea.value){ alert("Please input the proof of deposit string."); }

    try {
        const proofString = textArea.value;
        const proofElements = JSON.parse(atob(proofString));
        console.log("Proof Elements:", proofElements);

        console.log("Root:", proofElements.root);
        console.log("Hash:", proofElements.nullifierHash);

        receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [proofElements.txHash] });
        if(!receipt){ throw "empty-receipt"; }

        const log = receipt.logs[2];
        const decodedData = tornadoInterface.decodeEventLog("Deposit", log.data, log.topics);

        const SnarkJS = window['snarkjs'];

        const proofInput = {
            "root": $u.BNToDecimal(decodedData.root),
            "nullifierHash": proofElements.nullifierHash,
            "recipient": $u.BNToDecimal(account.address),
            "secret": $u.BN256ToBin(proofElements.secret).split(""),
            "nullifier": $u.BN256ToBin(proofElements.nullifier).split(""),
            "hashPairings": decodedData.hashPairings.map((n) => ($u.BNToDecimal(n))),
            "hashDirections": decodedData.pairDirection
        };

        console.log("final proof", proofInput);
        console.log("Nullifier Hash:", proofInput.nullifierHash);

        // Save proofInput to a JSON file
        const jsonBlob = new Blob([JSON.stringify(proofInput, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = jsonUrl;
        downloadLink.download = 'proofInput.json'; 
        downloadLink.click();
        
        const { proof, publicSignals } = await SnarkJS.groth16.fullProve(proofInput, "/withdraw.wasm", "/setup_final.zkey");

        const callInputs = [
            proof.pi_a.slice(0, 2).map($u.BN256ToHex),
            proof.pi_b.slice(0, 2).map((row) => ($u.reverseCoordinate(row.map($u.BN256ToHex)))),
            proof.pi_c.slice(0, 2).map($u.BN256ToHex),
            publicSignals.slice(0, 2).map($u.BN256ToHex)
        ];

        console.log("Proof data:", callInputs);

        var receipt;
        while(!receipt){
            receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            await new Promise((resolve, reject) => { setTimeout(resolve, 1000); });
        }

        if(!!receipt){ updateWithdrawalSuccessful(true); }

    } catch (e) {
        console.log(e);
    }

    updateWithdrawButtonState(ButtonState.Normal);
  };

  const tester = async () => {
    updateWithdrawButtonState(ButtonState.Disabled);

    if (!textArea || !textArea.value) { alert("Please input the proof of deposit string."); }

    try {
        const proofString = textArea.value;
        const proofElements = JSON.parse(atob(proofString));
        console.log("Proof Elements:", proofElements);

        console.log("Root:", proofElements.root);
        console.log("Hash:", proofElements.nullifierHash);

        receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [proofElements.txHash] });
        if (!receipt) { throw "empty-receipt"; }

        const log = receipt.logs[2];
        const decodedData = tornadoInterface.decodeEventLog("Deposit", log.data, log.topics);

        const SnarkJS = window['snarkjs'];

        const proofInput = {
            "root": $u.BNToDecimal(decodedData.root),
            "nullifierHash": proofElements.nullifierHash,
            "recipient": $u.BNToDecimal(account.address),
            "secret": $u.BN256ToBin(proofElements.secret).split(""),
            "nullifier": $u.BN256ToBin(proofElements.nullifier).split(""),
            "hashPairings": decodedData.hashPairings.map((n) => ($u.BNToDecimal(n))),
            "hashDirections": decodedData.pairDirection
        };

        console.log("final proof", proofInput);
        console.log("Nullifier Hash:", proofInput.nullifierHash);

        // Generate the proof and public signals
        const { proof, publicSignals } = await SnarkJS.groth16.fullProve(proofInput, "/withdraw.wasm", "/setup_final.zkey");

        console.log("Public Signals:", publicSignals);

        // Prepare the inputs for the verification
        const callInputs = [
            proof.pi_a.slice(0, 2).map($u.BN256ToHex),
            proof.pi_b.slice(0, 2).map((row) => ($u.reverseCoordinate(row.map($u.BN256ToHex)))),
            proof.pi_c.slice(0, 2).map($u.BN256ToHex),
            publicSignals.slice(0, 2).map($u.BN256ToHex)
        ];

        console.log("Proof data:", callInputs);

        console.log("Public Signals:", publicSignals);
        console.log("Proof:", proof);

        const vKeyResponse = await fetch("/verification_key.json");
        const vKey = await vKeyResponse.json();



        // Verify the proof with the public signals
        const isValid = await SnarkJS.groth16.verify(vKey, publicSignals, proof);
        if (isValid) {
            console.log("Proof is valid.");
            // Continue with your logic if the proof is valid
            var receipt;
            while (!receipt) {
                receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
                await new Promise((resolve) => { setTimeout(resolve, 1000); });
            }

            if (!!receipt) { updateWithdrawalSuccessful(true); }
        } else {
            console.log("Invalid proof.");
            // Handle invalid proof case here
        }

    } catch (e) {
        console.log(e);
    }

    updateWithdrawButtonState(ButtonState.Normal);
};



  const flashCopiedMessage = async () => {
      updateDisplayCopiedMessage(true);
      setTimeout(() => {
          updateDisplayCopiedMessage(false);
      }, 1000);
  }


  // useEffect(() => {
  //   const generateQRCodeWithAmount = async () => {
  //     const proofData = {
  //       proof: {
  //         root: "12345",
  //         nullifierHash: "67890",
  //         commitment: "abcdef",
  //         txHash: "0x1234567890abcdef",
  //       },
  //       amount: "50 UZAR",
  //     };

      
  //   };

  //   generateQRCodeWithAmount();
  // }, []);

  const downloadQRCode = () => {
    const link = document.createElement("a");
    link.href = qrCodeURL;
    link.download = "zkp_ocx.png";
    link.click();
  };

  const handleScan = () => {
    setIsScanned(true); // Set scan state to true
  };

  const [isHovered, setIsHovered] = useState(false);

  // DEMO STATE VARIABLES FOR TRANSFER UZAR SECTIONS
  const [transferMethod, setTransferMethod] = useState("crypto");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferButtonState, setTransferButtonState] = useState(ButtonState.Enabled);

  const sendUzarToCrypto = async () => {
    try {
      setTransferButtonState(ButtonState.Disabled);
      
      if (!recipientAddress || !transferAmount || transferAmount <= 0) {
        alert("Please enter a valid recipient address and amount");
        return;
      }
      
      
      //  crypto address transfer logic demo here
      console.log("Transferring", transferAmount, "UZAR to address:", recipientAddress);
      
      
      // reset form on success
      setRecipientAddress("");
      setTransferAmount("");
      
      alert("Transfer successful!");
      
    } catch (error) {
      console.error("Transfer failed:", error);
      alert("Transfer failed: " + error.message);
    } finally {
      setTransferButtonState(ButtonState.Enabled);
    }
  };

  const sendUzarToEmail = async () => {
    try {
      setTransferButtonState(ButtonState.Disabled);
      
      if (!recipientEmail || !transferAmount || transferAmount <= 0) {
        alert("Please enter a valid email address and amount");
        return;
      }
      
      //  email transfer logic demo here
      console.log("Transferring", transferAmount, "UZAR to email:", recipientEmail);
      
    
      // reset form on success
      setRecipientEmail("");
      setTransferAmount("");
      
      alert("Transfer initiated! The recipient will be notified via email.");
      
    } catch (error) {
      console.error("Email transfer failed:", error);
      alert("Transfer failed: " + error.message);
    } finally {
      setTransferButtonState(ButtonState.Enabled);
    }
  };



  return (
    <div className="min-h-screen ">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              {/* Hero Section */}
              <div className="flex flex-col lg:flex-row items-center justify-between mb-20">
                <div className="lg:w-1/2 mb-10 lg:mb-0">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                    Send Money
                    <span className="block">even when offline</span>
                  </h1>
                  <p className="text-black dark:text-white/80 text-lg mb-8 max-w-lg">
                    Explore the OffConnectX world. Buy and sell currencies easily on OffConnectX.
                  </p>

                  {/* connect wallet button and modal*/}

                  {!account && (
                    <div className="flex items-center space-x-4">
                    <button
                      onClick={connectMetamask}
                      className="flex items-center bg-[#346f8f] hover:bg-[#185371] dark:bg-[#346f8f]  dark:hover:bg-[#35677c] px-6 py-3 text-white font-medium rounded-full transition-all duration-300"
                    >
                      <AiFillPlayCircle className="mr-2 text-xl" />
                      Connect Wallet
                    </button>


                     {/* calling modal */}
                    <Modal />
                    </div>

                  )}
                </div>
      
                <div className="lg:w-2/5">
                  <div
                    className="relative rounded-2xl w-full max-w-md mx-auto h-56 overflow-hidden transition-all duration-700 ease-in-out hover:rotate-1 group"
                    style={{
                      background: 'linear-gradient(135deg, rgba(97,157,175) 0%, rgba(55,113,145,255) 100%)',
                      backdropFilter: "blur(8px)",
                      boxShadow: "0 10px 30px rgba(234, 229, 239, 0.2)",
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-white/10 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 group-hover:scale-150"></div>
                    <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-white/5 translate-x-1/2 translate-y-1/2 transition-all duration-700 group-hover:scale-125"></div>
      
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
      
                    <div className="flex justify-between flex-col h-full p-6 relative z-10">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-full border-2 border-white/80 flex justify-center items-center bg-white/20 backdrop-blur-md shadow-lg">
                          <SiEthereum fontSize={22} color="#fff" />
                        </div>
                        <BsInfoCircle
                          fontSize={18}
                          color="#fff"
                          className="opacity-80 hover:opacity-100 transition-opacity"
                        />
                      </div>
      
                      <div
                        className={`transition-all duration-700 ${isHovered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90"}`}
                      >
                        {account ? (
                          <div className="text-white mb-1">
                            <span className="font-semibold">{account.address.slice(0, 12) + "..."}</span>
                            <br />
                            <span className="text-white/80">
                              {account.balance.slice(0, 10) + (account.balance.length > 4 ? "..." : "")} ETH
                            </span>
                            <p className="font-bold text-2xl mt-2 tracking-wide">{uzarBalance} UZAR</p>
                          </div>
                        ) : (
                          <div className="text-2xl font-bold text-white mb-1">0 UZAR</div>
                        )}
                        <div className="text-xs text-white/70 mt-1">User Balance</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Conditional content based on wallet connection */}
{!account ? (
<>
  {/* Features Section shown when not connected*/}
  <div className="mb-20">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[
        {
          icon: <FaUserShield className="h-8 w-8" />,
          title: "Reliability",
          description: "Dependable transaction processing",
        },
        {
          icon: <FaLock className="h-8 w-8" />,
          title: "Security",
          description: "Enhanced encryption protocols",
        },
        {
          icon: <FaWifi className="h-8 w-8" />,
          title: "Offline",
          description: "Transactions without internet",
        },
        { 
          icon: <FaShieldAlt className="h-8 w-8" />, 
          title: "Privacy", 
          description: "Protected personal data" 
        },
        {
          icon: <FaDollarSign className="h-8 w-8" />,
          title: "Low Fees",
          description: "Minimal transaction costs",
        },
        {
          icon: <FaBook className="h-8 w-8" />,
          title: "Zero Knowledge",
          description: "Advanced cryptographic proofs"
        },
      ].map((feature, index) => (
        <div
          key={index}
          className="bg-white/10 dark:bg-white/5 backdrop-blur-sm rounded-xl p-8 flex flex-col items-center justify-center
                   border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300
                   hover:bg-white/20 dark:hover:bg-white/10 group"
        >
          <div className="mb-4 text-[#346f8f] dark:text-white p-4 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300">
            {feature.icon}
          </div>
          <h3 className="text-xl text-[#346f8f] dark:text-white font-medium text-center mb-2">{feature.title}</h3>
          <p className="text-black dark:text-white/60 text-center">{feature.description}</p>
        </div>
      ))}
    </div>
  </div>

  {/* How it Works shown only when not connected */}
  <div className="mb-20">
    <StepsProgress />
  </div>
</>
) : (
<>
  {/* Account Info Section - Only show when connected */}
  <div className="flex flex-col lg:flex-row lg:gap-8">

    {/* Approve UZAR section */}
    <div className="lg:w-1/2">
    <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-[#346f8f]/10 dark:border-white/10 mb-20">
      <h2 className="text-2xl font-semibold mb-6 text-[#346f8f] dark:text-white">Account Information</h2>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-lg text-[#346f8f]/80 dark:text-white/80">Address:</span>
          <span className="text-lg font-semibold text-[#346f8f] dark:text-white">
            {account.address.slice(0, 12) + "..." + account.address.slice(-8)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg text-[#346f8f]/80 dark:text-white/80">ETH Balance:</span>
          <span className="text-lg font-semibold text-[#346f8f] dark:text-white">
            {account.balance.slice(0, 10) + (account.balance.length > 10 ? "..." : "")} ETH
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg text-[#346f8f]/80 dark:text-white/80">UZAR Balance:</span>
          <span className="text-lg font-semibold text-[#346f8f] dark:text-white">{uzarBalance} UZAR</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg text-[#346f8f]/80 dark:text-white/80">Allowance:</span>
          <span className="text-lg font-semibold text-[#346f8f] dark:text-white">{allowance} UZAR</span>
        </div>
        <button
          className="w-full px-6 py-3 bg-[#346f8f] hover:bg-[#185371] text-white font-medium rounded-xl transition-all duration-300"
          onClick={approveUzar}
        >
          Approve UZAR
        </button>
      </div>
    </div>
    </div>


    {/* Transfer UZAR section */}
    <div className="lg:w-1/2">
    <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-[#346f8f]/10 dark:border-white/10 mb-20">
      <h2 className="text-2xl font-semibold mb-6 text-[#346f8f] dark:text-white">Transfer UZAR</h2>
      
      {/* transfer method selection */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setTransferMethod("crypto")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-all duration-300 rounded-xl text-base
                    ${
                      transferMethod === "crypto"
                        ? "bg-[#346f8f] hover:bg-[#185371] text-white"
                        : "bg-white/10 hover:bg-white/20 text-[#346f8f] dark:text-white"
                    }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Crypto Address
          </button>

          <button
            onClick={() => setTransferMethod("email")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-all duration-300 rounded-xl text-base
                    ${
                      transferMethod === "email"
                        ? "bg-[#346f8f] hover:bg-[#185371] text-white"
                        : "bg-white/10 hover:bg-white/20 text-[#346f8f] dark:text-white"
                    }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Address
          </button>
        </div>
      </div>

      {/* transfer form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-lg text-[#346f8f]/80 dark:text-white/80">
            {transferMethod === "crypto" ? "Recipient Address:" : "Email Address:"}
          </label>
          <input
            type={transferMethod === "crypto" ? "text" : "email"}
            className="w-full p-4 rounded-lg bg-white/5 border border-gray-200 dark:border-white/20 text-[#346f8f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#346f8f] shadow-inner"
            placeholder={transferMethod === "crypto" ? "0x1234567890abcdef..." : "recipient@example.com"}
            value={transferMethod === "crypto" ? recipientAddress : recipientEmail}
            onChange={(e) => {
              if (transferMethod === "crypto") {
                setRecipientAddress(e.target.value);
              } else {
                setRecipientEmail(e.target.value);
              }
            }}
          />
        </div>

        {/* amount field */}
        <div className="space-y-2">
      <label className="block text-lg text-[#346f8f]/80 dark:text-white/80">Amount (UZAR):</label>
      <input
        type="number"
        step="0.01"
        min="0"
        className="w-full p-4 rounded-lg bg-white/5 border border-gray-200 dark:border-white/20 text-[#346f8f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#346f8f] shadow-inner"
        placeholder="0.00"
        value={transferAmount}
        onChange={(e) => setTransferAmount(e.target.value)}
      />
    </div>

        {/* information box */}
        <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
          <p className="text-[#346f8f]/90 dark:text-white/90">
            {transferMethod === "crypto" 
              ? "Enter a valid Ethereum address to transfer UZAR tokens directly on-chain."
              : "Transfer UZAR to an email address. The recipient will be notified and can claim their tokens."
            }
          </p>
        </div>

        {/* Send button */}
        <button
          className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={transferMethod === "crypto" ? sendUzarToCrypto : sendUzarToEmail}
          disabled={
            !transferAmount || 
            transferAmount <= 0 || 
            (transferMethod === "crypto" ? !recipientAddress : !recipientEmail) ||
            transferButtonState === ButtonState.Disabled
          }
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send UZAR
          </div>
        </button>
      </div>
    </div>
    </div>
  </div>

  {/* QR Code Section shown only when connected */}
  <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/10 p-8 mb-20">
    <h2 className="text-2xl font-semibold mb-8 text-[#346f8f] dark:text-white">Your QR Code</h2>

    <div className="flex flex-col lg:flex-row items-center gap-8">
      <div className="lg:w-1/2 flex flex-col items-center">
        {!isScanned ? (
          <div className="flex flex-col items-center">
            <div className="bg-white/5 rounded-xl p-6 mb-4 w-64 h-64 flex items-center justify-center relative overflow-hidden shadow-inner border border-gray-200 dark:border-white/10 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative transition-transform duration-300 group-hover:scale-105 w-full h-full flex items-center justify-center">
                {qrCodeURL ? (
                  <img
                    src={qrCodeURL || "/placeholder.svg"}
                    alt="Generated QR Code with Amount"
                    onClick={handleScan}
                    className="w-full cursor-pointer hover:opacity-90 transition-opacity rounded-md"
                  />
                ) : (
                  <div className="animate-pulse flex flex-col items-center justify-center w-full h-full">
                    <div className="h-32 w-32 bg-white/10 rounded"></div>
                    <div className="mt-4 text-[#346f8f]/40 dark:text-white/40 text-sm">Generating QR code...</div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[#346f8f]/70 dark:text-white/70 text-sm">Click on the QR Code to simulate scanning.</p>

            {qrCodeURL && !isScanned && (
              <button
                className="flex items-center mt-4 px-4 py-2 text-[#346f8f] dark:text-white hover:bg-white/10 rounded-full transition-all duration-300 border border-transparent hover:border-gray-200 dark:hover:border-white/20"
                onClick={downloadQRCode}
              >
                <FaDownload className="mr-2" />
                Download QR Code
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-4">
              <div className="absolute w-full h-full rounded-full bg-red-500/10 animate-ping"></div>
              <div className="text-red-500 text-6xl font-light relative">X</div>
            </div>
            <p className="text-[#346f8f]/70 dark:text-white/70">QR Code has been scanned.</p>
          </div>
        )}
      </div>

      <div className="lg:w-1/2 space-y-4">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => updateSection("Deposit")}
            className={`flex items-center justify-center gap-2 py-4 px-6 font-medium transition-all duration-300 rounded-xl text-lg
                    ${
                      section === "Deposit"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-white/10 hover:bg-white/20 text-[#346f8f] dark:text-white"
                    }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Deposit
          </button>

          <button
            onClick={() => updateSection("Withdraw")}
            className={`flex items-center justify-center gap-2 py-4 px-6 font-medium transition-all duration-300 rounded-xl text-lg
                    ${
                      section !== "Deposit"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-white/10 hover:bg-white/20 text-[#346f8f] dark:text-white"
                    }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Withdraw
          </button>
        </div>

        {/* Deposit section */}
        {section === "Deposit" && !!account && (
          <div className="mt-6 space-y-4">
            {!!proofElements ? (
              <div className="space-y-4">
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                  <span className="font-semibold text-green-400 mb-2 block">Proof of Deposit:</span>
                  <div className="bg-white/5 rounded-md p-3 shadow-inner">
                    <span
                      className="text-xs break-all block text-[#346f8f]/80 dark:text-white/80"
                      ref={(proofStringEl) => {
                        updateProofStringEl(proofStringEl)
                      }}
                    >
                      {proofElements}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-6 py-3 bg-[#346f8f] hover:bg-[#3671de] rounded-full text-white font-medium transition-all duration-300"
                    onClick={copyProof}
                  >
                    Copy Proof String
                  </button>
                  {displayCopiedMessage && (
                    <span className="text-green-400 font-medium flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M20 6L9 17L4 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
                  <p className="text-[#346f8f]/90 dark:text-white/90">
                    All deposits and withdrawals are of the same denomination of 0.1 UZAR.
                  </p>
                </div>
                <button
                  className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={depositEther}
                  disabled={depositButtonState === ButtonState.Disabled}
                >
                  Deposit UZAR
                </button>
              </div>
            )}
          </div>
        )}

        {/* Withdraw section */}
        {section !== "Deposit" && !!account && (
          <div className="mt-6">
            {withdrawalSuccessful ? (
              <div className="                                                                                                                                                                                                                                                                                                           border border-green-700/50 rounded-lg p-5">
                <div className="flex items-center mb-2">
                  <svg
                    className="w-5 h-5 mr-2 text-green-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22 11.0818V12.0018C21.9988 14.1582 21.3005 16.2564 20.0093 17.9819C18.7182 19.7075 16.9033 20.9727 14.8354 21.5839C12.7674 22.1951 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.86182"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 4L12 14.01L9 11.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-semibold text-green-400">Success!</span>
                </div>
                <span className="block text-green-300">Withdrawal successfully completed.</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
                  <p className="text-[#346f8f]/90 dark:text-white/90">
                    All deposits and withdrawals are of the same denomination of UZAR.
                  </p>
                </div>

                <textarea
                  className="w-full p-4 rounded-lg bg-white/5 border border-gray-200 dark:border-white/20 text-[#346f8f] dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#346f8f] shadow-inner"
                  rows={4}
                  placeholder="Paste your proof here..."
                  ref={(ta) => {
                    updateTextArea(ta)
                  }}
                />

                <div className="flex gap-3">
                  <button
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={withdraw}
                    disabled={withdrawButtonState === ButtonState.Disabled}
                  >
                    Withdraw UZAR
                  </button>
                  <button
                    onClick={tester}
                    className="flex-1 px-6 py-3 border border-gray-200 dark:border-white/20 text-[#346f8f] dark:text-white hover:bg-white/10 font-medium rounded-xl transition-all duration-300"
                  >
                    Test UZAR Proof
                    </button>

                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </>
            )}
            </div>
          </div>
      
        )
      }
      
export default Welcome
