import React, { useState, useEffect } from 'react';
import './style.css';
import { db } from './firebase'; 
import { collection, addDoc, setDoc, onSnapshot, deleteDoc, doc, query, orderBy, limit, getDocs, where, getDoc } from 'firebase/firestore';

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
  
  const [saldoSugerido, setSaldoSugerido] = useState(null);
  const [cierreYaGuardado, setCierreYaGuardado] = useState(false); 

  const sedes = ['Supertienda La 34 Rivera', 'Market La 34 Barcelona'];
  const cajeros = ['MARCELA', 'CARLOS', 'MARIA B', 'FERNANDA', 'YESICA', 'ANGIE'];

  const generarIdCierre = () => {
    if (!fecha || !sede || !turno) return null;
    const sedeLimpia = sede.replace(/\s+/g, '').substring(0, 10);
    return `${fecha}_${sedeLimpia}_${turno}`;
  };

  // 1. CARGAR DATOS
  useEffect(() => {
    const qCompras = query(collection(db, "movimientos"), orderBy("hora", "desc"));
    const unsubscribeCompras = onSnapshot(qCompras, (snapshot) => {
      const datos = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setListaCompras(datos);
    });
    const qRest = query(collection(db, "deudas_restaurante"), orderBy("id", "desc"));
    const unsubscribeRest = onSnapshot(qRest, (snapshot) => {
      const datos = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setItemsRestaurante(datos);
    });
    
    const leerBaseRecargas = async () => {
        const docRef = doc(db, "configuracion", "base_recargas");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) { setBaseRecargas(docSnap.data().valor); }
        else { await setDoc(doc(db, "configuracion", "base_recargas"), { valor: 928000 }); }
    };
    leerBaseRecargas();

    return () => { unsubscribeCompras(); unsubscribeRest(); };
  }, []);

  // 2. RECUPERAR CIERRE
  useEffect(() => {
    const idCierre = generarIdCierre();
    if (!idCierre) return;

    // LIMPIEZA
    setZSistema(''); setDevoluciones(''); setEfectivoVentas('');
    setDatafono(''); setQrDatafono(''); setQrBancolombiaRiv(''); setQrBancolombiaBar(''); setQrBold(''); setDaviKamalaRiv(''); setDaviKamalaBar('');
    setCantVentas(''); setCantDatafonos(''); setCierreYaGuardado(false);
    setRSaldoPlataforma(''); setREfectivoFisico(''); setRComision('');
    setBancosConciliados({ datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false });
    setIdsFacturasAuditadas([]);

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

  // 3. SUGERIDO
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

  // --- CÁLCULOS AL VUELO ---
  const movimientosDelDia = listaCompras.filter(m => m.fecha === fecha && m.sede === sede && m.turno === turno);
  const totalGastadoEfectivo = movimientosDelDia.filter(c => c.tipo === 'GASTO' && c.tipoPago === 'Efectivo').reduce((acc, curr) => acc + curr.monto, 0);
  const totalIngresado = movimientosDelDia.filter(c => c.tipo === 'INGRESO').reduce((acc, curr) => acc + curr.monto, 0);
  const valorSaldoInicial = parseFloat(saldoInicial) || 0;
  const saldoFinalCompras = valorSaldoInicial - totalGastadoEfectivo + totalIngresado;
  const prestamoDeVentas = saldoFinalCompras < 0 ? Math.abs(saldoFinalCompras) : 0;
  const zReal = (parseFloat(zSistema) || 0) - (parseFloat(devoluciones) || 0);
  const totalBancos = (parseFloat(datafono)||0) + (parseFloat(qrDatafono)||0) + (parseFloat(qrBancolombiaRiv)||0) + (parseFloat(qrBancolombiaBar)||0) + (parseFloat(qrBold)||0) + (parseFloat(daviKamalaRiv)||0) + (parseFloat(daviKamalaBar)||0);
  const totalVentaRegistrada = (parseFloat(efectivoVentas)||0) + totalBancos + prestamoDeVentas;
  const descuadre = totalVentaRegistrada - zReal;
  const efectivoEsperado = baseRecargas - (parseFloat(rSaldoPlataforma) || 0);
  const descuadreRecargas = (parseFloat(rEfectivoFisico) || 0) - efectivoEsperado;
  const totalConciliado = (bancosConciliados.datafono ? parseFloat(datafono)||0 : 0) + (bancosConciliados.qrDatafono ? parseFloat(qrDatafono)||0 : 0) + (bancosConciliados.qrRiv ? parseFloat(qrBancolombiaRiv)||0 : 0) + (bancosConciliados.qrBar ? parseFloat(qrBancolombiaBar)||0 : 0) + (bancosConciliados.qrBold ? parseFloat(qrBold)||0 : 0) + (bancosConciliados.daviRiv ? parseFloat(daviKamalaRiv)||0 : 0) + (bancosConciliados.daviBar ? parseFloat(daviKamalaBar)||0 : 0);
  
  const numVentasValido = parseFloat(cantVentas) > 0 ? parseFloat(cantVentas) : 1;
  const ticketPromedio = (parseFloat(cantVentas) > 0) ? (totalVentaRegistrada / numVentasValido) : 0;

  // --- DESCARGAR EXCEL MEJORADO V30 ---
  const descargarReporte = async () => {
    try {
        const q = query(collection(db, "cierres_turnos"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const datos = querySnapshot.docs.map(doc => doc.data());

        if (datos.length === 0) return alert("No hay datos para descargar");

        let csvContent = "data:text/csv;charset=utf-8,";
        // CABECERAS NUEVAS
        csvContent += "Fecha,Sede,Turno,Cajero,Venta Z Real,Venta Real Total,Efectivo Ventas,Total Bancos,Total Gastos Efectivo,Descuadre,Ticket Promedio,# Facturas,# Datafonos\n";

        datos.forEach(row => {
            let ticket = parseFloat(row.ticketPromedio) || 0;
            if (!isFinite(ticket)) ticket = 0;
            
            // Cálculos para el reporte
            const zSistemaRow = parseFloat(row.zSistema) || 0;
            const devolucionesRow = parseFloat(row.devoluciones) || 0;
            const zRealRow = zSistemaRow - devolucionesRow;
            const totalGastosRow = row.totalGastosGuardado || 0; // Este es el nuevo dato clave

            const fila = [
                row.fecha,
                row.sede,
                row.turno,
                row.cajero,
                zRealRow, // Nueva columna Z Real
                row.ventaReal || 0,
                row.ventaEfectivoSolo || 0,
                (row.ventaReal - (row.ventaEfectivoSolo || 0)) || 0,
                totalGastosRow, // Ahora sí sale el número!
                row.descuadre || 0,
                Math.round(ticket),
                row.numVentas || 0, // Nueva columna
                row.numDatafonos || 0 // Nueva columna
            ].join(",");
            csvContent += fila + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Reporte_Kamala_V30.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        alert("Error descargando: " + error.message);
    }
  };

  const iniciarTurno = () => { if (sede && cajero && turno) { setDatosTurno({ sede, cajero, turno, fecha }); setVista('MENU'); } else alert('⚠️ Completa los datos.'); };
  const cerrarSesion = () => { 
    setDatosTurno(null); setVista('LOGIN'); setSede(''); setCajero(''); setTurno(''); setSaldoInicial(''); setZSistema(''); setDevoluciones(''); setEfectivoVentas(''); 
    setDatafono(''); setQrDatafono(''); setQrBancolombiaRiv(''); setQrBancolombiaBar(''); setQrBold(''); setDaviKamalaRiv(''); setDaviKamalaBar('');
    setCantVentas(''); setCantDatafonos(''); setRSaldoPlataforma(''); setREfectivoFisico(''); setRComision(''); setValorModificarBase(''); setMostrarInputBase(false); 
    setIdsFacturasAuditadas([]); setBancosConciliados({ datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false }); 
  };
  
  const registrarEnCaja = async (desc, val, tipo) => { await addDoc(collection(db, "movimientos"), { proveedor: desc, monto: parseFloat(val), tipoPago: 'Efectivo', tipo: tipo, hora: new Date().toLocaleTimeString(), fecha: fecha, sede: sede, turno: turno }); };
  const agregarCompra = async () => { if (!proveedor || !monto) return alert('Faltan datos'); await addDoc(collection(db, "movimientos"), { proveedor, monto: parseFloat(monto), tipoPago: tipoMovimiento === 'INGRESO' ? 'Efectivo' : tipoPago, tipo: tipoMovimiento, hora: new Date().toLocaleTimeString(), fecha: fecha, sede: sede, turno: turno }); setProveedor(''); setMonto(''); };
  const borrarCompra = async (id) => { if (window.confirm("¿Seguro de borrar?")) { await deleteDoc(doc(db, "movimientos", id)); } };
  const prestarRestaurante = async () => { if (!conceptoRest || !valorRest) return alert('Faltan datos'); await addDoc(collection(db, "deudas_restaurante"), { id: Date.now(), concepto: conceptoRest, valor: parseFloat(valorRest), fecha: fecha, sede: sede, turno: turno }); registrarEnCaja(`Préstamo Rest: ${conceptoRest}`, valorRest, 'GASTO'); setConceptoRest(''); setValorRest(''); alert('✅ Deuda registrada en Nube.'); };
  const toggleSeleccion = (id) => { if (idsSeleccionados.includes(id)) { setIdsSeleccionados(prev => prev.filter(i => i !== id)); } else { setIdsSeleccionados(prev => [...prev, id]); } };
  const cobrarRestaurante = async () => { if (idsSeleccionados.length === 0) return alert('Selecciona qué van a pagar'); const itemsAPagar = itemsRestaurante.filter(item => idsSeleccionados.includes(item.id)); const totalPagar = itemsAPagar.reduce((acc, curr) => acc + curr.valor, 0); registrarEnCaja('Pago Deuda Restaurante', totalPagar, 'INGRESO'); for (let item of itemsAPagar) { await deleteDoc(doc(db, "deudas_restaurante", item.id)); } setIdsSeleccionados([]); alert(`✅ ¡Pago registrado!`); };
  const borrarDeudaRestaurante = async (id) => { if (window.confirm("¿Seguro borrar esta deuda?")) { await deleteDoc(doc(db, "deudas_restaurante", id)); } };
  const modificarBase = async () => { 
    if (!valorModificarBase) return; const valor = parseFloat(valorModificarBase); 
    let nuevaBase = baseRecargas;
    if (tipoModificacion === 'SUMAR') { nuevaBase = baseRecargas + valor; alert(`✅ Base aumentada. Nueva: $${nuevaBase.toLocaleString()}`); } 
    else { nuevaBase = baseRecargas - valor; alert(`🎄 Retiro aplicado. Nueva: $${nuevaBase.toLocaleString()}`); }
    setBaseRecargas(nuevaBase);
    await setDoc(doc(db, "configuracion", "base_recargas"), { valor: nuevaBase }); 
    setValorModificarBase(''); setMostrarInputBase(false); 
  };
  const entrarAdmin = () => { if (passAdmin === '1234') { setVista('ADMIN'); setPassAdmin(''); } else { alert('❌ Contraseña incorrecta'); } };
  const toggleFacturaAuditada = (id) => { if (idsFacturasAuditadas.includes(id)) setIdsFacturasAuditadas(idsFacturasAuditadas.filter(i => i !== id)); else setIdsFacturasAuditadas([...idsFacturasAuditadas, id]); };
  const toggleBanco = (key) => setBancosConciliados({ ...bancosConciliados, [key]: !bancosConciliados[key] });

  const guardarCierreTurno = async () => {
    if(!zSistema || !efectivoVentas) return alert("Faltan datos del cierre");
    const idCierre = generarIdCierre();
    if (!idCierre) return alert("Faltan datos sede/turno");
    try {
        await setDoc(doc(db, "cierres_turnos", idCierre), { 
            fecha: fecha, sede: datosTurno.sede, cajero: datosTurno.cajero, turno: datosTurno.turno, 
            zSistema, devoluciones, ventaEfectivoSolo: parseFloat(efectivoVentas) || 0,
            saldoInicialGuardado: valorSaldoInicial,
            totalGastosGuardado: totalGastadoEfectivo, // AQUÍ GUARDAMOS EL TOTAL DE GASTOS NUMÉRICO
            bancos: { datafono, qrDatafono, qrRiv: qrBancolombiaRiv, qrBar: qrBancolombiaBar, qrBold, daviRiv: daviKamalaRiv, daviBar: daviKamalaBar },
            ventaReal: totalVentaRegistrada, saldoFinalCompras: saldoFinalCompras, 
            numVentas: parseFloat(cantVentas) || 0, numDatafonos: parseFloat(cantDatafonos) || 0, 
            ticketPromedio: ticketPromedio, descuadre: descuadre, 
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

  if (vista === 'LOGIN') { return ( <div className="container"><div className="login-card"><div className="header"><h1>Supertiendas Kamala</h1><p>Sistema de Control de Caja</p></div><div className="form-group"><label>📅 Fecha del Turno:</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div><div className="form-group"><label>🏪 Sede:</label><select value={sede} onChange={(e) => setSede(e.target.value)}><option value="">-- Selecciona --</option>{sedes.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div className="form-group"><label>👤 Cajero/a:</label><select value={cajero} onChange={(e) => setCajero(e.target.value)}><option value="">-- Selecciona --</option>{cajeros.map((c) => <option key={c} value={c}>{c}</option>)}</select></div><div className="form-group"><label>⏰ Turno:</label><div className="radio-group"><label className={`radio-btn ${turno === 'AM' ? 'active' : ''}`}><input type="radio" name="turno" value="AM" onChange={() => setTurno('AM')} /> AM</label><label className={`radio-btn ${turno === 'PM' ? 'active' : ''}`}><input type="radio" name="turno" value="PM" onChange={() => setTurno('PM')} /> PM</label></div></div><button className="btn-start" onClick={iniciarTurno}>🚀 INICIAR TURNO</button></div></div> ); }
  if (vista === 'MENU') { return ( <div className="dashboard-container"><div className="top-bar"><div><h2>Hola, {datosTurno.cajero} 👋</h2><p className="subtitle">{datosTurno.sede} | {datosTurno.turno}</p><p className="nota-mini">📅 Trabajando en fecha: {fecha}</p></div><button className="btn-logout" onClick={cerrarSesion}>Salir</button></div><div className="menu-grid"><button className="menu-card color-blue" onClick={() => setVista('COMPRAS')}><span className="icon">🛒</span><h3>Compras y Gastos</h3><p>Registrar facturas</p></button><button className="menu-card color-green" onClick={() => setVista('VENTAS')}><span className="icon">💰</span><h3>Cierre de Ventas</h3><p>Cuadre de caja y Z</p></button><button className="menu-card color-purple" onClick={() => setVista('RECARGAS')}><span className="icon">📱</span><h3>Recargas</h3><p>Control de saldo</p></button><button className="menu-card color-orange" onClick={() => setVista('RESTAURANTE')}><span className="icon">🍽️</span><h3>Restaurante</h3><p>Deudas y pagos</p></button></div><div className="admin-access"><p>🔐 Acceso Privado:</p><div className="row-admin"><input type="password" placeholder="Contraseña" value={passAdmin} onChange={(e) => setPassAdmin(e.target.value)} /><button onClick={entrarAdmin}>Entrar</button></div></div></div> ); }
  if (vista === 'COMPRAS') { 
    const diferenciaSaldo = saldoSugerido !== null ? (valorSaldoInicial - saldoSugerido) : 0;
    return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('MENU')}>⬅ Volver</button><h2>Compras y Caja</h2></div><div className="form-card" style={{border: '2px solid #3498db', backgroundColor: '#eaf2f8'}}>{saldoSugerido !== null ? (<div style={{marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px'}}><p style={{margin:0, fontSize:'14px', color:'#7f8c8d'}}>🤖 El sistema calcula que deberían haber:</p><h3 style={{margin:0, color:'#2c3e50'}}>${saldoSugerido.toLocaleString()}</h3></div>) : (<p style={{fontStyle:'italic', fontSize:'12px', color:'#999'}}>Sin datos previos para sugerir saldo.</p>)}<label>🖐️ Tú cuentas (Lo que recibiste):</label><input type="number" placeholder="Saldo Real en mano" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} style={{fontSize:'20px', fontWeight:'bold', color:'#2c3e50'}} />{saldoSugerido !== null && diferenciaSaldo !== 0 && (<p style={{color:'red', fontWeight:'bold', marginTop:'5px'}}>⚠️ Diferencia: ${diferenciaSaldo.toLocaleString()}</p>)}{saldoSugerido !== null && diferenciaSaldo === 0 && (<p style={{color:'green', fontWeight:'bold', marginTop:'5px'}}>✅ ¡Coincide Perfecto!</p>)}</div><div className={`saldo-card ${saldoFinalCompras < 0 ? 'bg-red' : ''}`}><p className="saldo-restante">{saldoFinalCompras < 0 ? '⚠️ Faltante (Se toma de Ventas):' : 'Quedan:'} <strong> ${saldoFinalCompras.toLocaleString()}</strong></p></div><div className="form-card"><div className="switch-container"><button className={`btn-switch ${tipoMovimiento === 'GASTO' ? 'active-red' : ''}`} onClick={() => setTipoMovimiento('GASTO')}>🔴 GASTO (Salida)</button><button className={`btn-switch ${tipoMovimiento === 'INGRESO' ? 'active-green' : ''}`} onClick={() => setTipoMovimiento('INGRESO')}>🟢 INGRESO (Entrada)</button></div><h3>{tipoMovimiento === 'GASTO' ? 'Registrar Salida' : 'Registrar Entrada Extra'}</h3><div className="row"><input className="input-largo" placeholder={tipoMovimiento === 'GASTO' ? "Proveedor" : "Concepto"} value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></div><div className="row"><input type="number" placeholder="Valor ($)" value={monto} onChange={(e) => setMonto(e.target.value)} />{tipoMovimiento === 'GASTO' && (<select value={tipoPago} onChange={(e) => setTipoPago(e.target.value)}><option value="Efectivo">Efectivo Caja</option><option value="Davivienda">Transf. Davivienda</option><option value="Tarjeta">Tarjeta Crédito</option></select>)}</div><button className={`btn-add ${tipoMovimiento === 'INGRESO' ? 'btn-green' : ''}`} onClick={agregarCompra}>{tipoMovimiento === 'GASTO' ? '- REGISTRAR GASTO' : '+ REGISTRAR INGRESO'}</button></div><div className="lista-compras"><h3>Movimientos del Turno ({fecha})</h3><div className="resumen-block"><div className="resumen-item text-dark" style={{borderBottom:'1px solid #ddd', marginBottom:'5px', paddingBottom:'5px'}}><span>💰 Saldo Inicial:</span><strong>${valorSaldoInicial.toLocaleString()}</strong></div><div className="resumen-item text-green"><span>Ingresos Extras:</span><strong>+${totalIngresado.toLocaleString()}</strong></div><div className="resumen-item text-red"><span>Gastos Efectivo:</span><strong>-${totalGastadoEfectivo.toLocaleString()}</strong></div><div className="resumen-separator"></div><div className="resumen-item text-dark"><span>Disponible Real:</span><strong>${saldoFinalCompras.toLocaleString()}</strong></div></div>{movimientosDelDia.length === 0 ? (<p className="empty-msg">No hay gastos registrados en esta fecha.</p>) : (movimientosDelDia.map((item) => (<div key={item.id} className="item-compra"><div className="info"><span className="hora">{item.hora}</span><strong>{item.proveedor}</strong><span className="tipo-pago">{item.tipo === 'INGRESO' ? '🟢 Entrada Extra' : `🔴 ${item.tipoPago}`}</span></div><div className={`valor ${item.tipo === 'INGRESO' ? 'text-green' : ''}`}>{item.tipo === 'INGRESO' ? '+' : '-'}${item.monto.toLocaleString()}<button className="btn-delete" onClick={() => borrarCompra(item.id)}>🗑️</button></div></div>)))}</div></div> ); }
  if (vista === 'VENTAS') { return ( <div className="dashboard-container"><div className="top-bar"><button className="btn-back" onClick={() => setVista('MENU')}>⬅ Volver</button><h2>Cierre de Ventas</h2></div>
  {cierreYaGuardado && <div className="aviso-prestamo" style={{backgroundColor:'#e3f2fd', color:'#0d47a1', borderColor:'#90caf9'}}>👁️ Mostrando datos GUARDADOS de este turno.</div>}
  <div className="form-card"><h3>1. Datos del Sistema (Aliaddo)</h3><div className="row"><div className="half"><label>Valor Cierre Z:</label><input type="number" placeholder="0" value={zSistema} onChange={(e) => setZSistema(e.target.value)} /></div><div className="half"><label>Devoluciones:</label><input type="number" placeholder="0" value={devoluciones} onChange={(e) => setDevoluciones(e.target.value)} /></div></div><div className="resultado-intermedio">Venta Z REAL: <strong>${zReal.toLocaleString()}</strong></div></div><div className="form-card"><h3>2. Ingresa el Dinero</h3><label>💵 Efectivo en Ventas:</label><input type="number" className="input-full" placeholder="$ Efectivo billetes y monedas" value={efectivoVentas} onChange={(e) => setEfectivoVentas(e.target.value)} />{prestamoDeVentas > 0 && (<div className="aviso-prestamo"><span>⚠️ Préstamo tomado para Compras:</span><strong>+${prestamoDeVentas.toLocaleString()}</strong></div>)}<h4 className="subtitulo-bancos">Bancos y QRs</h4><div className="grid-bancos"><div><label>Datafono:</label><input type="number" placeholder="$" value={datafono} onChange={(e) => setDatafono(e.target.value)} /></div><div><label>QR Datáfono (Antes Davi):</label><input type="number" placeholder="$" value={qrDatafono} onChange={(e) => setQrDatafono(e.target.value)} /></div><div><label>QR Rivera:</label><input type="number" placeholder="$ Bancolombia" value={qrBancolombiaRiv} onChange={(e) => setQrBancolombiaRiv(e.target.value)} /></div><div><label>QR Barcelona:</label><input type="number" placeholder="$ Bancolombia" value={qrBancolombiaBar} onChange={(e) => setQrBancolombiaBar(e.target.value)} /></div><div><label>QR BOLD:</label><input type="number" placeholder="$" value={qrBold} onChange={(e) => setQrBold(e.target.value)} /></div><div><label>🔴 DaviKamala Rivera:</label><input type="number" placeholder="$" value={daviKamalaRiv} onChange={(e) => setDaviKamalaRiv(e.target.value)} /></div><div><label>🔴 DaviKamala Barce:</label><input type="number" placeholder="$" value={daviKamalaBar} onChange={(e) => setDaviKamalaBar(e.target.value)} /></div></div><div className="resultado-intermedio">Total Dinero + Bancos + Préstamos: <strong>${totalVentaRegistrada.toLocaleString()}</strong></div></div><div className="form-card"><h3>3. Estadísticas del Turno</h3><div className="row"><div className="half"><label>🧾 No. Facturas:</label><input type="number" placeholder="Cant. Ventas" value={cantVentas} onChange={(e) => setCantVentas(e.target.value)} /></div><div className="half"><label>💳 No. Datáfonos:</label><input type="number" placeholder="Cant. Transac" value={cantDatafonos} onChange={(e) => setCantDatafonos(e.target.value)} /></div></div><div className="ticket-info">Ticket Promedio: <strong>${ticketPromedio.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></div></div><div className={`veredicto-card ${descuadre === 0 ? 'perfecto' : descuadre < 0 ? 'faltante' : 'sobrante'}`}><h3>Resultado del Cuadre</h3><p className="gran-numero">${descuadre