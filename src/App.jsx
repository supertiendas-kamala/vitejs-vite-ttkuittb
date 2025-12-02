import React, { useState, useEffect } from 'react';
import './style.css';
import { db } from './firebase'; 
import { collection, addDoc, setDoc, onSnapshot, deleteDoc, doc, query, orderBy, limit, getDocs, where, getDoc, updateDoc, increment } from 'firebase/firestore';

export default function App() {
  const [vista, setVista] = useState('LOGIN'); 
  const [datosTurno, setDatosTurno] = useState(null); 
  const [sede, setSede] = useState('');
  const [cajero, setCajero] = useState('');
  const [turno, setTurno] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  // COMPRAS
  const [saldoInicial, setSaldoInicial] = useState(() => localStorage.getItem('saldoInicial_temp') || ''); 
  useEffect(() => { localStorage.setItem('saldoInicial_temp', saldoInicial); }, [saldoInicial]);

  const [listaCompras, setListaCompras] = useState([]); 
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [tipoPago, setTipoPago] = useState('Efectivo'); 
  const [tipoMovimiento, setTipoMovimiento] = useState('GASTO');
  const [idsFacturasAuditadas, setIdsFacturasAuditadas] = useState([]);

  // LISTA DE PROVEEDORES SUGERIDOS
  const proveedoresFijos = ["Coca Cola", "Postobón", "Bimbo", "Margarita", "Zenú", "Alquería", "Colanta", "D1", "Ara", "Servicios Públicos", "Nómina", "Arriendo", "DaviKamala", "Reserva Kamala", "Otros"];

  // VENTAS
  const [zSistema, setZSistema] = useState('');
  const [devoluciones, setDevoluciones] = useState('');
  const [efectivoVentas, setEfectivoVentas] = useState('');
  const [datafono, setDatafono] = useState('');
  const [qrDatafono, setQrDatafono] = useState(''); 
  const [qrBancolombiaRiv, setQrBancolombiaRiv] = useState('');
  const [qrBancolombiaBar, setQrBancolombiaBar] = useState('');
  const [qrBold, setQrBold] = useState('');
  const [daviKamalaRiv, setDaviKamalaRiv] = useState('');
  const [daviKamalaBar, setDaviKamalaBar] = useState('');
  const [cantVentas, setCantVentas] = useState(''); 
  const [cantDatafonos, setCantDatafonos] = useState(''); 

  const [bancosConciliados, setBancosConciliados] = useState({
    datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false
  });
  const [passAdmin, setPassAdmin] = useState('');
  const [passReserva, setPassReserva] = useState(''); 
  
  // RECARGAS
  const [baseRecargas, setBaseRecargas] = useState(928000); 
  const [rSaldoPlataforma, setRSaldoPlataforma] = useState(''); 
  const [rEfectivoFisico, setREfectivoFisico] = useState(''); 
  const [rComision, setRComision] = useState(''); 
  const [valorModificarBase, setValorModificarBase] = useState('');
  const [mostrarInputBase, setMostrarInputBase] = useState(false);
  const [tipoModificacion, setTipoModificacion] = useState('');

  // RESTAURANTE
  const [itemsRestaurante, setItemsRestaurante] = useState([]); 
  const [conceptoRest, setConceptoRest] = useState('');
  const [valorRest, setValorRest] = useState('');
  const [idsSeleccionados, setIdsSeleccionados] = useState([]); 
  
  const [saldoReserva, setSaldoReserva] = useState(0);
  const [resumenDia, setResumenDia] = useState({ rivera: {}, barcelona: {}, total: {} });

  const [saldoSugerido, setSaldoSugerido] = useState(null);
  const [cierreYaGuardado, setCierreYaGuardado] = useState(false); 

  const sedes = ['Supertienda La 34 Rivera', 'Market La 34 Barcelona'];
  const cajeros = ['MARCELA', 'CARLOS', 'MARIA B', 'FERNANDA', 'YESICA', 'ANGIE'];

  const generarIdCierre = () => {
    if (!fecha || !sede || !turno) return null;
    const sedeLimpia = sede.replace(/\s+/g, '').substring(0, 10);
    return `${fecha}_${sedeLimpia}_${turno}`;
  };

  // 1. CARGA INICIAL
  useEffect(() => {
    const qCompras = query(collection(db, "movimientos"), orderBy("hora", "desc"));
    onSnapshot(qCompras, (snap) => setListaCompras(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    
    const qRest = query(collection(db, "deudas_restaurante"), orderBy("id", "desc"));
    onSnapshot(qRest, (snap) => setItemsRestaurante(snap.docs.map(d => ({ ...d.data(), id: d.id }))));

    getDoc(doc(db, "configuracion", "base_recargas")).then(d => { if(d.exists()) setBaseRecargas(d.data().valor); });
    
    onSnapshot(doc(db, "configuracion", "reserva_kamala"), (d) => { 
        if(d.exists()) setSaldoReserva(d.data().saldo || 0); 
        else setDoc(doc(db, "configuracion", "reserva_kamala"), { saldo: 0 });
    });
  }, []);

  // 2. CÁLCULO DEL RESUMEN GERENCIAL (SOLO SE VE EN ADMIN)
  useEffect(() => {
    const calcularResumen = async () => {
        // Trae movimientos de la fecha seleccionada en el calendario
        const q = query(collection(db, "movimientos"), where("fecha", "==", fecha));
        const snap = await getDocs(q);
        const movs = snap.docs.map(d => d.data());

        const movsRiv = movs.filter(m => m.sede && m.sede.includes("Rivera"));
        const movsBar = movs.filter(m => m.sede && m.sede.includes("Barcelona"));

        const calc = (lista) => {
            const entradas = lista.filter(m => m.tipo === 'INGRESO').reduce((acc, el) => acc + el.monto, 0);
            const salidas = lista.filter(m => m.tipo === 'GASTO').reduce((acc, el) => acc + el.monto, 0);
            return { entradas, salidas, utilidad: entradas - salidas };
        };

        const riv = calc(movsRiv);
        const bar = calc(movsBar);
        
        setResumenDia({
            rivera: riv,
            barcelona: bar,
            total: {
                entradas: riv.entradas + bar.entradas,
                salidas: riv.salidas + bar.salidas,
                utilidad: riv.utilidad + bar.utilidad
            }
        });
    };
    calcularResumen();
  }, [fecha, listaCompras]); // Se actualiza si cambias la fecha o hay movimientos nuevos

  // LOGICA RESERVA
  const moverReserva = async (accion, valor) => {
      if (!valor) return;
      const montoNum = parseFloat(valor);
      const nuevoSaldo = accion === 'METER' ? saldoReserva + montoNum : saldoReserva - montoNum;
      await updateDoc(doc(db, "configuracion", "reserva_kamala"), { saldo: nuevoSaldo });
      if (accion === 'SACAR') { registrarEnCaja("Ingreso desde Reserva Kamala", montoNum, 'INGRESO'); alert("✅ Dinero sacado de Reserva y puesto en Caja."); } 
      else { registrarEnCaja("Traslado a Reserva Kamala", montoNum, 'GASTO'); alert("✅ Dinero sacado de Caja y guardado en Reserva."); }
  };

  // RECUPERAR CIERRE
  useEffect(() => {
    const idCierre = generarIdCierre();
    if (!idCierre) return;
    // Limpieza
    setZSistema(''); setDevoluciones(''); setEfectivoVentas(''); setDatafono(''); setQrDatafono(''); setQrBancolombiaRiv(''); setQrBancolombiaBar(''); setQrBold(''); setDaviKamalaRiv(''); setDaviKamalaBar(''); setCantVentas(''); setCantDatafonos(''); setCierreYaGuardado(false); setRSaldoPlataforma(''); setREfectivoFisico(''); setRComision(''); setBancosConciliados({ datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false }); setIdsFacturasAuditadas([]);

    const unsubscribe = onSnapshot(doc(db, "cierres_turnos", idCierre), (docSnap) => {
      if (docSnap.exists()) {
        const datos = docSnap.data();
        setCierreYaGuardado(true);
        if (datos.saldoInicialGuardado) setSaldoInicial(datos.saldoInicialGuardado);
        setZSistema(datos.zSistema || ''); setDevoluciones(datos.devoluciones || ''); setEfectivoVentas(datos.ventaEfectivoSolo || '');
        setDatafono(datos.bancos?.datafono || ''); setQrDatafono(datos.bancos?.qrDatafono || '');
        setQrBancolombiaRiv(datos.bancos?.qrRiv || ''); setQrBancolombiaBar(datos.bancos?.qrBar || '');
        setQrBold(datos.bancos?.qrBold || ''); setDaviKamalaRiv(datos.bancos?.daviRiv || ''); setDaviKamalaBar(datos.bancos?.daviBar || '');
        setCantVentas(datos.numVentas || ''); setCantDatafonos(datos.numDatafonos || '');
        if (datos.auditoriaBancos) setBancosConciliados(datos.auditoriaBancos);
        if (datos.facturasAuditadas) setIdsFacturasAuditadas(datos.facturasAuditadas);
      } 
    });
    return () => unsubscribe();
  }, [fecha, sede, turno]);

  // SUGERIDO
  useEffect(() => {
      const fetchUltimoCierreSede = async () => {
          if (!sede) return;
          try {
              const qCierres = query(collection(db, "cierres_turnos"), orderBy("timestamp", "desc"), limit(30));
              const querySnapshot = await getDocs(qCierres);
              const ultimoSede = querySnapshot.docs.find(doc => doc.data().sede === sede);
              if (ultimoSede) {
                  const data = ultimoSede.data();
                  const sugerido = (parseFloat(data.saldoFinalCompras) || 0) + (parseFloat(data.ventaEfectivoSolo) || 0);
                  setSaldoSugerido(sugerido);
              } else { setSaldoSugerido(null); }
          } catch (e) { console.log("Error", e); }
      };
      fetchUltimoCierreSede();
  }, [sede]);

  const iniciarTurno = () => { if (sede && cajero && turno) { setDatosTurno({ sede, cajero, turno, fecha }); setVista('MENU'); } else alert('⚠️ Completa los datos.'); };
  const cerrarSesion = () => { setDatosTurno(null); setVista('LOGIN'); setSede(''); setCajero(''); setTurno(''); setSaldoInicial(''); setZSistema(''); setDevoluciones(''); setEfectivoVentas(''); setDatafono(''); setQrDatafono(''); setQrBancolombiaRiv(''); setQrBancolombiaBar(''); setQrBold(''); setDaviKamalaRiv(''); setDaviKamalaBar(''); setCantVentas(''); setCantDatafonos(''); setRSaldoPlataforma(''); setREfectivoFisico(''); setRComision(''); setValorModificarBase(''); setMostrarInputBase(false); setBaseRecargas(928000); setIdsFacturasAuditadas([]); setBancosConciliados({ datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false }); };
  
  const registrarEnCaja = async (desc, val, tipo) => { await addDoc(collection(db, "movimientos"), { proveedor: desc, monto: parseFloat(val), tipoPago: 'Efectivo', tipo: tipo, hora: new Date().toLocaleTimeString(), fecha: fecha, sede: sede, turno: turno }); };
  const agregarCompra = async () => { if (!proveedor || !monto) return alert('Faltan datos'); await addDoc(collection(db, "movimientos"), { proveedor, monto: parseFloat(monto), tipoPago: tipoMovimiento === 'INGRESO' ? 'Efectivo' : tipoPago, tipo: tipoMovimiento, hora: new Date().toLocaleTimeString(), fecha: fecha, sede: sede, turno: turno }); setProveedor(''); setMonto(''); };
  const borrarCompra = async (id) => { if (window.confirm("¿Seguro de borrar?")) { await deleteDoc(doc(db, "movimientos", id)); } };
  const prestarRestaurante = async () => { if (!conceptoRest || !valorRest) return alert('Faltan datos'); await addDoc(collection(db, "deudas_restaurante"), { id: Date.now(), concepto: conceptoRest, valor: parseFloat(valorRest), fecha: fecha, sede: sede, turno: turno }); registrarEnCaja(`Préstamo Rest: ${conceptoRest}`, valorRest, 'GASTO'); setConceptoRest(''); setValorRest(''); alert('✅ Deuda registrada en Nube.'); };
  const toggleSeleccion = (id) => { if (idsSeleccionados.includes(id)) { setIdsSeleccionados(prev => prev.filter(i => i !== id)); } else { setIdsSeleccionados(prev => [...prev, id]); } };
  const cobrarRestaurante = async () => { if (idsSeleccionados.length === 0) return alert('Selecciona qué van a pagar'); const itemsAPagar = itemsRestaurante.filter(item => idsSeleccionados.includes(item.id)); const totalPagar = itemsAPagar.reduce((acc, curr) => acc + curr.valor, 0); registrarEnCaja('Pago Deuda Restaurante', totalPagar, 'INGRESO'); for (let item of itemsAPagar) { await deleteDoc(doc(db, "deudas_restaurante", item.id)); } setIdsSeleccionados([]); alert(`✅ ¡Pago registrado!`); };
  const borrarDeudaRestaurante = async (id) => { if (window.confirm("¿Seguro borrar esta deuda?")) { await deleteDoc(doc(db, "deudas_restaurante", id)); } };
  const modificarBase = async () => { if (!valorModificarBase) return; const valor = parseFloat(valorModificarBase); let nuevaBase = baseRecargas; if (tipoModificacion === 'SUMAR') { nuevaBase = baseRecargas + valor; alert(`✅ Base aumentada. Nueva: $${nuevaBase.toLocaleString()}`); } else { nuevaBase = baseRecargas - valor; alert(`🎄 Retiro aplicado. Nueva: $${nuevaBase.toLocaleString()}`); } setBaseRecargas(nuevaBase); await setDoc(doc(db, "configuracion", "base_recargas"), { valor: nuevaBase }); setValorModificarBase(''); setMostrarInputBase(false); };
  
  // ACCESOS CON NUEVAS CLAVES
  const entrarAdmin = () => { if (passAdmin === '2308') { setVista('ADMIN'); setPassAdmin(''); } else { alert('❌ Clave incorrecta'); } };
  const entrarReserva = () => { if (passReserva === '1208') { setVista('RESERVA'); setPassReserva(''); } else { alert('❌ Clave incorrecta'); } };

  const toggleFacturaAuditada = (id) => { if (idsFacturasAuditadas.includes(id)) setIdsFacturasAuditadas(idsFacturasAuditadas.filter(i => i !== id)); else setIdsFacturasAuditadas([...idsFacturasAuditadas, id]); };
  const toggleBanco = (key) => setBancosConciliados({ ...bancosConciliados, [key]: !bancosConciliados[key] });

  const movimientosDelDia = listaCompras.filter(m => m.fecha === fecha && m.sede === sede && m.turno === turno);
  const totalGastadoEfectivo = movimientosDelDia.filter(c => c.tipo === 'GASTO' && c.tipoPago === 'Efectivo').reduce((acc, curr) => acc + curr.monto, 0);
  const totalIngresado = movimientosDelDia.filter(c => c.tipo === 'INGRESO').reduce((acc, curr) => acc + curr.monto, 0);
  const valorSaldoInicial = parseFloat(saldoInicial) || 0;
  const saldoFinalCompras = valorSaldoInicial - totalGastadoEfectivo + totalIngresado;
  const prestamoDeVentas = saldoFinalCompras < 0 ? Math.abs(saldoFinalCompras) : 0;
  const diferenciaMovimientos = totalIngresado - totalGastadoEfectivo;
  const zReal = (parseFloat(zSistema) || 0) - (parseFloat(devoluciones) || 0);
  const totalBancos = (parseFloat(datafono)||0) + (parseFloat(qrDatafono)||0) + (parseFloat(qrBancolombiaRiv)||0) + (parseFloat(qrBancolombiaBar)||0) + (parseFloat(qrBold)||0) + (parseFloat(daviKamalaRiv)||0) + (parseFloat(daviKamalaBar)||0);
  const totalVentaRegistrada = (parseFloat(efectivoVentas)||0) + totalBancos + prestamoDeVentas;
  const descuadre = totalVentaRegistrada - zReal;
  const efectivoEsperado = baseRecargas - (parseFloat(rSaldoPlataforma) || 0);
  const descuadreRecargas = (parseFloat(rEfectivoFisico) || 0) - efectivoEsperado;
  const totalConciliado = (bancosConciliados.datafono ? parseFloat(datafono)||0 : 0) + (bancosConciliados.qrDatafono ? parseFloat(qrDatafono)||0 : 0) + (bancosConciliados.qrRiv ? parseFloat(qrBancolombiaRiv)||0 : 0) + (bancosConciliados.qrBar ? parseFloat(qrBancolombiaBar)||0 : 0) + (bancosConciliados.qrBold ? parseFloat(qrBold)||0 : 0) + (bancosConciliados.daviRiv ? parseFloat(daviKamalaRiv)||0 : 0) + (bancosConciliados.daviBar ? parseFloat(daviKamalaBar)||0 : 0);
  const ticketPromedio = (parseFloat(cantVentas) > 0) ? (totalVentaRegistrada / parseFloat(cantVentas)) : 0;

  const guardarCierreTurno = async () => {
    if(!zSistema || !efectivoVentas) return alert("Faltan datos del cierre");
    const idCierre = generarIdCierre();
    if (!idCierre) return alert("Faltan datos sede/turno");
    try {
        await setDoc(doc(db, "cierres_turnos", idCierre), { 
            fecha: fecha, sede: datosTurno.sede, cajero: datosTurno.cajero, turno: datosTurno.turno, 
            zSistema, devoluciones, ventaEfectivoSolo: parseFloat(efectivoVentas) || 0,
            saldoInicialGuardado: valorSaldoInicial,
            bancos: { datafono, qrDatafono, qrRiv: qrBancolombiaRiv, qrBar: qrBancolombiaBar, qrBold, daviRiv: daviKamalaRiv, daviBar: daviKamalaBar },
            ventaReal: totalVentaRegistrada, saldoFinalCompras: saldoFinalCompras, 
            numVentas: parseFloat(cantVentas) || 0, numDatafonos: parseFloat(cantDatafonos) || 0, 
            ticketPromedio: ticketPromedio, descuadre: descuadre, 
            gastosTurno: totalGastadoEfectivo,
            hora: new Date().toLocaleTimeString(), timestamp: Date.now()
        }, { merge: true });
        alert("✅ ¡Cierre guardado exitosamente!");
        setVista('MENU'); 
    } catch (e) { alert("Error guardando: " + e.message); }
  };

  const guardarRevisionAdmin = async () => {
    const idCierre = generarIdCierre();
    if (!idCierre) return alert("Selecciona Fecha/Sede/Turno primero.");
    try {
        await setDoc(doc(db, "cierres_turnos", idCierre), { auditoriaBancos: bancosConciliados, facturasAuditadas: idsFacturasAuditadas }, { merge: true });
        alert("👑 ¡Revisión guardada!");
        setVista('MENU');
    } catch (e) { alert("Error: " + e.message); }
  };

  const descargarReporte = async () => {
    try {
        const q = query(collection(db, "cierres_turnos"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const datos = querySnapshot.docs.map(doc => doc.data());
        if (datos.length === 0) return alert("No hay datos");
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Fecha,Sede,Turno,Cajero,Venta Real Total,Z Sistema,Descuadre,Efectivo Ventas,Total Bancos,Gastos Turno,# Facturas,# Datafonos,Ticket Promedio\n";
        datos.forEach(row => {
            let ticket = parseFloat(row.ticketPromedio) || 0; if (!isFinite(ticket)) ticket = 0;
            const fila = [ row.fecha, row.sede, row.turno, row.cajero, row.ventaReal || 0, row.zSistema || 0, row.descuadre || 0, row.ventaEfectivoSolo || 0, (row.ventaReal - (row.ventaEfectivoSolo || 0)) || 0, row.gastosTurno || 0, row.numVentas || 0, row.numDatafonos || 0, Math.round(ticket) ].join(",");
            csvContent += fila + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "Reporte_Kamala_Full.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { alert("Error: " + error.message); }
  };
  
  const fechaBonita = new Date(fecha + "T00:00:00").toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  if (vista === 'LOGIN') { return ( <div className="container"><div className="login-card"><div className="header"><h1>Supertiendas Kamala</h1><p>Sistema de Control de Caja</p></div>
    <div className="form-group"><label>📅 Fecha del Turno:</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div><div className="form-group"><label>🏪 Sede:</label><select value={sede} onChange={(e) => setSede(e.target.value)}><option value="">-- Selecciona --</option>{sedes.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div className="form-group"><label>👤 Cajero/a:</label><select value={cajero} onChange={(e) => setCajero(e.target.value)}><option value="">-- Selecciona --</option>{cajeros.map((c) => <option key={c} value={c}>{c}</option>)}</select></div><div className="form-group"><label>⏰ Turno:</label><div className="radio-group"><label className={`radio-btn ${turno === 'AM' ? 'active' : ''}`}><input type="radio" name="turno" value="AM" onChange={() => setTurno('AM')} /> AM</label><label className={`radio-btn ${turno === 'PM' ? 'active' : ''}`}><input type="radio" name="turno" value="PM" onChange={() => setTurno('PM')} /> PM</label></div></div><button className="btn-start" onClick={iniciarTurno}>🚀 INICIAR TURNO</button>
    <div className="accesos-privados" style={{marginTop:'30px', display:'flex', gap:'10px', justifyContent:'center'}}><div className="mini-login"><small>👑 KAMALA</small><input type="password" placeholder="Clave" value={passAdmin} onChange={(e) => setPassAdmin(e.target.value)} style={{width:'60px'}}/><button onClick={entrarAdmin}>Ir</button></div><div className="mini-login"><small>🔒 RESERVA</small><input type="password" placeholder="Clave" value={passReserva} onChange={(e) => setPassReserva(e.target.value)} style={{width:'60px'}}/><button onClick={entrarReserva}>Ir</button></div></div>
  </div></div> ); }

  // VISTA ADMIN (KAMALA)
  if (vista === 'ADMIN') { return ( <div className="dashboard-container"><div className="top-bar admin-header"><button className="btn-back white-text" onClick={() => setVista('LOGIN')}>⬅ Salir</button><h2>Panel KAMALA 👑</h2></div>
  
  {/* RESUMEN MOVIDO AQUÍ */}
  <div className="resumen-gerencial"><h3>📊 Resumen: {fechaBonita}</h3><div className="fila-resumen"><strong>Rivera:</strong> <span className="verde">Ing: ${resumenDia.rivera.entradas?.toLocaleString()}</span> | <span className="rojo">Gas: ${resumenDia.rivera.salidas?.toLocaleString()}</span></div><div className="fila-resumen"><span>Utilidad Rivera:</span><strong style={{color: resumenDia.rivera.utilidad >= 0 ? 'green' : 'red'}}>${resumenDia.rivera.utilidad?.toLocaleString()}</strong></div><hr/><div className="fila-resumen"><strong>Barcelona:</strong> <span className="verde">Ing: ${resumenDia.barcelona.entradas?.toLocaleString()}</span> | <span className="rojo">Gas: ${resumenDia.barcelona.salidas?.toLocaleString()}</span></div><div className="fila-resumen"><span>Utilidad Barce:</span><strong style={{color: resumenDia.barcelona.utilidad >= 0 ? 'green' : 'red'}}>${resumenDia.barcelona.utilidad?.toLocaleString()}</strong></div>
  
  {/* TOTAL COMPLETO */}
  <div className="fila-resumen total" style={{flexDirection:'column', gap:'5px'}}>
    <div style={{display:'flex', justifyContent:'space-between'}}><strong>KAMALA TOTAL:</strong></div>
    <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
        <span>Ing: <span className="verde">${resumenDia.total.entradas?.toLocaleString()}</span></span>
        <span>Gas: <span className="rojo">${resumenDia.total.salidas?.toLocaleString()}</span></span>
    </div>
    <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px', borderTop:'1px solid #ccc', paddingTop:'5px'}}>
        <span>Utilidad Neta:</span>
        <strong className="azul" style={{fontSize:'16px'}}>${resumenDia.total.utilidad?.toLocaleString()}</strong>
    </div>
  </div>
  </div>

  <div className="form-card" style={{textAlign:'center', backgroundColor:'#e8f5e9'}}><h3>📊 Reportes</h3><p className="nota-mini">Descarga toda la BD:</p><button className="btn-guardar-cierre" style={{marginTop:'10px', background:'#2e7d32'}} onClick={descargarReporte}>📥 DESCARGAR EXCEL</button></div><div className="form-card"><h3>🏦 Conciliación Bancaria del Día</h3><p className="nota-mini">Marca lo que ya confirmaste que llegó al banco:</p><div className="lista-checks"><div className="item-check" onClick={() => toggleBanco('datafono')}><div className={`checkbox-sq ${bancosConciliados.datafono ? 'checked' : ''}`}></div><span>Datafono Rivera (${datafono || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrDatafono')}><div className={`checkbox-sq ${bancosConciliados.qrDatafono ? 'checked' : ''}`}></div><span>QR Datáfono (${qrDatafono || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrRiv')}><div className={`checkbox-sq ${bancosConciliados.qrRiv ? 'checked' : ''}`}></div><span>QR Bancolombia Rivera (${qrBancolombiaRiv || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrBar')}><div className={`checkbox-sq ${bancosConciliados.qrBar ? 'checked' : ''}`}></div><span>QR Bancolombia Barcelona (${qrBancolombiaBar || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrBold')}><div className={`checkbox-sq ${bancosConciliados.qrBold ? 'checked' : ''}`}></div><span>QR BOLD Unificado (${qrBold || 0})</span></div><div className="item-check" onClick={() => toggleBanco('daviRiv')}><div className={`checkbox-sq ${bancosConciliados.daviRiv ? 'checked' : ''}`}></div><span>DaviKamala Rivera (${daviKamalaRiv || 0})</span></div><div className="item-check" onClick={() => toggleBanco('daviBar')}><div className={`checkbox-sq ${bancosConciliados.daviBar ? 'checked' : ''}`}></div><span>DaviKamala Barce (${daviKamalaBar || 0})</span></div></div><div className="total-conciliado">Total Conciliado: <strong>${totalConciliado.toLocaleString()}</strong></div><button className="btn-guardar-cierre" style={{marginTop:'10px', background:'#27ae60'}} onClick={guardarRevisionAdmin}>💾 GUARDAR VISTO BUENO</button></div><div className="form-card"><h3>📝 Auditoría de Facturas</h3><p className="nota-mini">Revisa contra el papel físico:</p>{movimientosDelDia.filter(c => c.tipo === 'GASTO').length === 0 ? (<p className="empty-msg">No hay gastos registrados hoy.</p>) : (movimientosDelDia.filter(c => c.tipo === 'GASTO').map((item) => (<div key={item.id} className="item-compra" onClick={() => toggleFacturaAuditada(item.id)}><div className="check-area"><div className={`checkbox-sq ${idsFacturasAuditadas.includes(item.id) ? 'checked' : ''}`}></div></div><div className="info"><span className="hora">{item.hora}</span><strong>{item.proveedor}</strong><span className="tipo-pago">{item.tipoPago}</span></div><div className="valor text-red">-${item.monto.toLocaleString()}</div></div>)))}</div></div> ); }

  // VISTA RESERVA... (igual)
  if (vista === 'RESERVA') { return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('LOGIN')}>⬅ Salir</button><h2>Reserva Kamala 🔐</h2></div><div className="saldo-card" style={{background:'linear-gradient(135deg, #2c3e50, #000000)'}}><p style={{margin:0, fontSize:'14px', opacity:0.8}}>Saldo Disponible en Caja Fuerte:</p><h1 style={{margin:0, fontSize:'36px'}}>${saldoReserva.toLocaleString()}</h1></div><div className="form-card"><h3>Movimientos de Reserva</h3><div className="row"><input type="number" placeholder="Valor a mover" value={valorModificarBase} onChange={(e) => setValorModificarBase(e.target.value)} /></div><button className="btn-add btn-green" onClick={() => moverReserva('METER', valorModificarBase)} style={{marginBottom:'10px'}}>📥 METER DINERO (Sobra de Compras)</button><button className="btn-add bg-red" onClick={() => moverReserva('SACAR', valorModificarBase)}>📤 SACAR DINERO (Falta en Compras)</button></div></div> ); }
  
  // ... (Otras vistas igual) ...
  if (vista === 'MENU') { return ( <div className="dashboard-container"><div className="top-bar"><div><h2>Hola, {datosTurno.cajero} 👋</h2><p className="subtitle">{datosTurno.sede} | {datosTurno.turno}</p><p className="nota-mini">📅 {fechaBonita}</p></div><button className="btn-logout" onClick={cerrarSesion}>Salir</button></div><div className="menu-grid"><button className="menu-card color-blue" onClick={() => setVista('COMPRAS')}><span className="icon">🛒</span><h3>Compras y Gastos</h3><p>Registrar facturas</p></button><button className="menu-card color-green" onClick={() => setVista('VENTAS')}><span className="icon">💰</span><h3>Cierre de Ventas</h3><p>Cuadre de caja y Z</p></button><button className="menu-card color-purple" onClick={() => setVista('RECARGAS')}><span className="icon">📱</span><h3>Recargas</h3><p>Control de saldo</p></button><button className="menu-card color-orange" onClick={() => setVista('RESTAURANTE')}><span className="icon">🍽️</span><h3>Restaurante</h3><p>Deudas y pagos</p></button></div><div className="admin-access"><p>🔐 Acceso Privado:</p><div className="row-admin"><input type="password" placeholder="Contraseña" value={passAdmin} onChange={(e) => setPassAdmin(e.target.value)} /><button onClick={entrarAdmin}>Entrar</button></div></div></div> ); }
  if (vista === 'COMPRAS') { return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('MENU')}>⬅ Volver</button><h2>Compras y Caja</h2></div><div className={`saldo-card ${saldoFinalCompras < 0 ? 'bg-red' : ''}`}><label>💰 Saldo Efectivo Disponible:</label><input type="number" placeholder="Saldo Inicial..." value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />{saldoSugerido !== null && (<p className="nota-mini" style={{color:'yellow'}}>💡 Sugerido según turno anterior: ${saldoSugerido.toLocaleString()}</p>)}<p className="saldo-restante">{saldoFinalCompras < 0 ? '⚠️ Faltante (Se toma de Ventas):' : 'Quedan:'} <strong> ${saldoFinalCompras.toLocaleString()}</strong></p></div><div className="form-card"><div className="switch-container"><button className={`btn-switch ${tipoMovimiento === 'GASTO' ? 'active-red' : ''}`} onClick={() => setTipoMovimiento('GASTO')}>🔴 GASTO (Salida)</button><button className={`btn-switch ${tipoMovimiento === 'INGRESO' ? 'active-green' : ''}`} onClick={() => setTipoMovimiento('INGRESO')}>🟢 INGRESO (Entrada)</button></div><h3>{tipoMovimiento === 'GASTO' ? 'Registrar Salida' : 'Registrar Entrada Extra'}</h3><div className="row"><input className="input-largo" list="proveedores-list" placeholder={tipoMovimiento === 'GASTO' ? "Escribe o elige Proveedor" : "Concepto"} value={proveedor} onChange={(e) => setProveedor(e.target.value)} /><datalist id="proveedores-list">{proveedoresFijos.map((p, i) => <option key={i} value={p} />)}</datalist></div><div className="row"><input type="number" placeholder="Valor ($)" value={monto} onChange={(e) => setMonto(e.target.value)} />{tipoMovimiento === 'GASTO' && (<select value={tipoPago} onChange={(e) => setTipoPago(e.target.value)}><option value="Efectivo">Efectivo Caja</option><option value="Davivienda">Transf. Davivienda</option><option value="Tarjeta">Tarjeta Crédito</option></select>)}</div><button className={`btn-add ${tipoMovimiento === 'INGRESO' ? 'btn-green' : ''}`} onClick={agregarCompra}>{tipoMovimiento === 'GASTO' ? '- REGISTRAR GASTO' : '+ REGISTRAR INGRESO'}</button></div><div className="lista-compras"><h3>Movimientos del Turno ({fecha})</h3><div className="resumen-block"><div className="resumen-item text-dark" style={{borderBottom:'1px solid #ddd', marginBottom:'5px', paddingBottom:'5px'}}><span>💰 Saldo Inicial:</span><strong>${valorSaldoInicial.toLocaleString()}</strong></div><div className="resumen-item text-green"><span>Ingresos Extras:</span><strong>+${totalIngresado.toLocaleString()}</strong></div><div className="resumen-item text-red"><span>Gastos Efectivo:</span><strong>-${totalGastadoEfectivo.toLocaleString()}</strong></div><div className="resumen-separator"></div><div className="resumen-item text-dark"><span>Disponible Real:</span><strong>${saldoFinalCompras.toLocaleString()}</strong></div></div>{movimientosDelDia.length === 0 ? (<p className="empty-msg">No hay gastos registrados en esta fecha.</p>) : (movimientosDelDia.map((item) => (<div key={item.id} className="item-compra"><div className="info"><span className="hora">{item.hora}</span><strong>{item.proveedor}</strong><span className="tipo-pago">{item.tipo === 'INGRESO' ? '🟢 Entrada Extra' : `🔴 ${item.tipoPago}`}</span></div><div className={`valor ${item.tipo === 'INGRESO' ? 'text-green' : ''}`}>{item.tipo === 'INGRESO' ? '+' : '-'}${item.monto.toLocaleString()}<button className="btn-delete" onClick={() => borrarCompra(item.id)}>🗑️</button></div></div>)))}</div></div> ); }
  if (vista === 'VENTAS') { return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('MENU')}>⬅ Volver</button><h2>Cierre de Ventas</h2></div>{cierreYaGuardado && <div className="aviso-prestamo" style={{backgroundColor:'#e3f2fd', color:'#0d47a1', borderColor:'#90caf9'}}>👁️ Mostrando datos GUARDADOS de este turno.</div>}<div className="form-card"><h3>1. Datos del Sistema (Aliaddo)</h3><div className="row"><div className="half"><label>Valor Cierre Z:</label><input type="number" placeholder="0" value={zSistema} onChange={(e) => setZSistema(e.target.value)} /></div><div className="half"><label>Devoluciones:</label><input type="number" placeholder="0" value={devoluciones} onChange={(e) => setDevoluciones(e.target.value)} /></div></div><div className="resultado-intermedio">Venta Z REAL: <strong>${zReal.toLocaleString()}</strong></div></div><div className="form-card"><h3>2. Ingresa el Dinero</h3><label>💵 Efectivo en Ventas:</label><input type="number" className="input-full" placeholder="$ Efectivo billetes y monedas" value={efectivoVentas} onChange={(e) => setEfectivoVentas(e.target.value)} />{prestamoDeVentas > 0 && (<div className="aviso-prestamo"><span>⚠️ Préstamo tomado para Compras:</span><strong>+${prestamoDeVentas.toLocaleString()}</strong></div>)}<h4 className="subtitulo-bancos">Bancos y QRs</h4><div className="grid-bancos"><div><label>Datafono:</label><input type="number" placeholder="$" value={datafono} onChange={(e) => setDatafono(e.target.value)} /></div><div><label>QR Datáfono (Antes Davi):</label><input type="number" placeholder="$" value={qrDatafono} onChange={(e) => setQrDatafono(e.target.value)} /></div><div><label>QR Rivera:</label><input type="number" placeholder="$ Bancolombia" value={qrBancolombiaRiv} onChange={(e) => setQrBancolombiaRiv(e.target.value)} /></div><div><label>QR Barcelona:</label><input type="number" placeholder="$ Bancolombia" value={qrBancolombiaBar} onChange={(e) => setQrBancolombiaBar(e.target.value)} /></div><div><label>QR BOLD:</label><input type="number" placeholder="$" value={qrBold} onChange={(e) => setQrBold(e.target.value)} /></div><div><label>🔴 DaviKamala Rivera:</label><input type="number" placeholder="$" value={daviKamalaRiv} onChange={(e) => setDaviKamalaRiv(e.target.value)} /></div><div><label>🔴 DaviKamala Barce:</label><input type="number" placeholder="$" value={daviKamalaBar} onChange={(e) => setDaviKamalaBar(e.target.value)} /></div></div><div className="resultado-intermedio">Total Dinero + Bancos + Préstamos: <strong>${totalVentaRegistrada.toLocaleString()}</strong></div></div><div className="form-card"><h3>3. Estadísticas del Turno</h3><div className="row"><div className="half"><label>🧾 No. Facturas:</label><input type="number" placeholder="Cant. Ventas" value={cantVentas} onChange={(e) => setCantVentas(e.target.value)} /></div><div className="half"><label>💳 No. Datáfonos:</label><input type="number" placeholder="Cant. Transac" value={cantDatafonos} onChange={(e) => setCantDatafonos(e.target.value)} /></div></div><div className="ticket-info">Ticket Promedio: <strong>${ticketPromedio.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></div></div><div className={`veredicto-card ${descuadre === 0 ? 'perfecto' : descuadre < 0 ? 'faltante' : 'sobrante'}`}><h3>Resultado del Cuadre</h3><p className="gran-numero">${descuadre.toLocaleString()}</p><p className="mensaje-estado">{descuadre === 0 ? '✅ ¡CUADRE PERFECTO!' : descuadre < 0 ? '❌ FALTANTE (OJO)' : '⚠️ SOBRANTE (REVISA)'}</p></div><button className="btn-guardar-cierre" onClick={guardarCierreTurno}>💾 GUARDAR CIERRE Y ESTADÍSTICAS</button></div> ); }
  if (vista === 'RESTAURANTE') { return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('MENU')}>⬅ Volver</button><h2>Restaurante</h2></div><div className="form-card"><h3>📤 Registrar Nuevo Préstamo</h3><div className="row"><input className="input-largo" placeholder="¿Qué se llevaron? (Ej: Papas)" value={conceptoRest} onChange={(e) => setConceptoRest(e.target.value)} /></div><div className="row"><input type="number" placeholder="Valor ($)" value={valorRest} onChange={(e) => setValorRest(e.target.value)} /><button className="btn-add bg-orange" onClick={prestarRestaurante}>PRESTAR</button></div><p className="nota-mini">* Esto restará dinero de tu caja automáticamente.</p></div><div className="lista-compras"><h3>📥 Cuentas por Cobrar</h3>{itemsRestaurante.length === 0 ? (<p className="empty-msg">El restaurante está a paz y salvo. ✅</p>) : (<div>{itemsRestaurante.map((item) => (<div key={item.id} className={`item-compra ${idsSeleccionados.includes(item.id) ? 'seleccionado' : ''}`} onClick={() => toggleSeleccion(item.id)}><div className="check-area"><div className={`checkbox-custom ${idsSeleccionados.includes(item.id) ? 'checked' : ''}`} onClick={(e) => {e.stopPropagation(); toggleSeleccion(item.id)}}></div></div><div className="info"><span className="hora">{item.fecha}</span><strong>{item.concepto}</strong></div><div className="valor text-red">-${item.valor.toLocaleString()}</div><button className="btn-delete" style={{marginLeft: '10px', fontSize: '16px'}} onClick={(e) => {e.stopPropagation(); borrarDeudaRestaurante(item.id)}}>🗑️</button></div>))}<button className="btn-cobrar" onClick={cobrarRestaurante}>RECIBIR PAGO DE LO SELECCIONADO 💰</button></div>)}</div></div> ); }
  if (vista === 'RECARGAS') { return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('MENU')}>⬅ Volver</button><h2>Recargas</h2></div><div className="card-informativa"><strong>Base Actual:</strong> ${baseRecargas.toLocaleString()}{!mostrarInputBase ? (<div style={{marginTop: '10px'}}><button className="btn-link" onClick={() => {setTipoModificacion('SUMAR'); setMostrarInputBase(true)}}>+ Sumar Comisión</button><button className="btn-link text-red" onClick={() => {setTipoModificacion('RESTAR'); setMostrarInputBase(true)}}>🎄 Sacar Cena/Gastos</button></div>) : (<div className="input-base-container"><span style={{fontSize:'12px', marginRight:'5px'}}>{tipoModificacion === 'SUMAR' ? 'Sumar:' : 'Restar:'}</span><input type="number" placeholder="Valor" value={valorModificarBase} onChange={(e) => setValorModificarBase(e.target.value)} /><button className="btn-small-ok" onClick={modificarBase}>OK</button><button className="btn-small-cancel" onClick={() => setMostrarInputBase(false)}>X</button></div>)}</div><div className="form-card"><h3>1. Información de Plataforma</h3><label>📲 Saldo Final en Sistema:</label><input type="number" className="input-full" placeholder="Lo que dice la app de recargas" value={rSaldoPlataforma} onChange={(e) => setRSaldoPlataforma(e.target.value)} /><div className="calculo-recargas">Debes tener en efectivo: <br/><strong>${efectivoEsperado > 0 ? efectivoEsperado.toLocaleString() : '0'}</strong></div></div><div className="form-card"><h3>2. Conteo de Dinero</h3><label>💵 Efectivo Físico Recargas:</label><input type="number" className="input-full" placeholder="Lo que contaste" value={rEfectivoFisico} onChange={(e) => setREfectivoFisico(e.target.value)} /></div><div className={`veredicto-card ${descuadreRecargas === 0 ? 'perfecto' : descuadreRecargas < 0 ? 'faltante' : 'sobrante'}`}><h3>Estado de Recargas</h3><p className="gran-numero">${descuadreRecargas.toLocaleString()}</p><p className="mensaje-estado">{descuadreRecargas === 0 ? '✅ ¡CUADRE PERFECTO!' : descuadreRecargas < 0 ? '❌ FALTANTE DE DINERO' : '⚠️ SOBRANTE DE DINERO'}</p></div><div className="form-card mt-20"><label>📝 Registro de Comisión (Informativo):</label><input type="number" className="input-comision" placeholder="Ganancia del día" value={rComision} onChange={(e) => setRComision(e.target.value)} /></div></div> ); }
}