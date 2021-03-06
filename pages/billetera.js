import React, { useEffect, useContext, useState } from "react";
import axios from "axios";
import { Paper, Button, Tooltip } from "@material-ui/core";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import useInterval from "../hooks/useInterval";
import { FirebaseContext } from "../firebase";
import { useRouter } from "next/router";
import CustomToolbarSelect from "../components/CustomToolbarSelect";
import CustomFooter from "../components/CustomFooter";
import MUIDataTable from "mui-datatables";
import TableFooter from "@material-ui/core/TableFooter";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import useStyles from "../src/styles";
import TableNumberFormat from "../components/TableNumberFormat";
import textLabelsSpanish from "../components/tableLabelsLocation";
import Events from "../components/layout/Events";
import CustomActionsSelect from "../components/CustomActionsSelect";

export default function Billetera() {
  const [mensaje, setMensaje] = useState("Cargando...");
  const [mostrarConCantidad, setMostrarConCantidad] = useState(true);
  const [filaSelected, setFilaSelected] = useState([]);
  const [filaExpanded, setFilaExpanded] = useState([]);
  const [billetera, setBilletera] = useState([]);
  const [monedas, setMonedas] = useState([]);
  const [valores, setValores] = useState({});
  const [valoresBSC, setValoresBSC] = useState([]);
  const [siglas, setSiglas] = useState("");
  const [totales, setTotales] = useState({
    compra: 0,
    actual: 0,
    posicion: 0,
  });

  const { usuario, firebase } = useContext(FirebaseContext);
  const router = useRouter();

  useEffect(() => {
    if (usuario) {
      const { uid } = usuario;
      const obtenerBilletera = () => {
        firebase.db
          .collection("billetera")
          .orderBy("creado", "asc")
          .where("usuario", "==", uid)
          .onSnapshot(manejarSnapshot);
      };

      obtenerBilletera();
    }
  }, [usuario]);

  function manejarSnapshot(snapshot) {
    let sumacompra = 0;
    let miSiglas = "";
    const result = snapshot.docs.map((doc) => {
      sumacompra = sumacompra + parseFloat(doc.data().valorcompra);
      miSiglas = miSiglas + doc.data().id_API + ",";
      return {
        id: doc.id,
        ...doc.data(),
      };
    });
    miSiglas = miSiglas.slice(0, -1);
    setTotales({ ...totales, compra: sumacompra });
    setSiglas(miSiglas);
    setMonedas(result);
    if (result.length == 0)
      setMensaje("No hay monedas Cargadas. Por favor diríjase a Cargar Moneda");
  }

  useEffect(() => {
    if (siglas) buscoValor();
  }, [siglas]);

  useInterval(() => {
    if (siglas) buscoValor();
  }, 5000);

  useEffect(() => {
    const actualizoTotales = () => {
      const sumoactual = billetera.reduce(function (acc, el) {
        return acc + el.totalUSDT;
      }, 0);

      //Actualizo totales
      setTotales({
        ...totales,
        actual: sumoactual,
        posicion: (sumoactual / totales.compra - 1) * 100,
      });
    };
    if (billetera) actualizoTotales();
  }, [billetera]);

  useEffect(() => {
    if (Object.keys(valores).length != 0) {
      setBilletera(concatenarBilletera());
    }
  }, [valores, mostrarConCantidad]);

  const concatenarBilletera = () => {
    const concatena = monedas.map((moneda) => {
      if (
        !mostrarConCantidad ||
        (mostrarConCantidad && parseFloat(moneda.cantidad) > 0)
      ) {
        let cotUSDT = moneda.cotizacion;
        let cotBTC = 0;
        let moneda_actual;
        if (moneda.id_API.length < 42) {
          moneda_actual = valores.filter((el) => el.id == moneda.id_API);
          if (moneda_actual.length > 0 && moneda.cotizacion == 0) {
            cotUSDT = moneda_actual[0].current_price;
          }
        } else {
          const moneda_actual_billetera = billetera.filter(
            (el) => el.id_API == moneda.id_API
          );
          let valorActualBilletera = 0;
          if (moneda_actual_billetera.length != 0)
            valorActualBilletera = moneda_actual_billetera[0].cotizacionUSDT;

          moneda_actual = valoresBSC.filter((el) => el.id == moneda.id_API);
          if (moneda_actual.length > 0 && moneda.cotizacion == 0) {
            cotUSDT = moneda_actual[0].current_price;
          } else if (moneda_actual.length === 0 && moneda.cotizacion == 0) {
            cotUSDT = valorActualBilletera;
          }
        }
        const totalUSDT = moneda.cantidad * cotUSDT;
        const totalBTC = moneda.cantidad * cotBTC;
        let posicionUSDT = 0;
        if (totalUSDT > 0 && moneda.valorcompra > 0) {
          posicionUSDT = (totalUSDT / moneda.valorcompra - 1) * 100;
        }
        const elBilletera = {
          id: moneda.id,
          id_API: moneda.id_API,
          sigla: moneda.sigla,
          nombre: moneda.nombre,
          cantidad: parseFloat(moneda.cantidad),
          valorcompra: parseFloat(moneda.valorcompra),
          cotizacion: parseFloat(moneda.cotizacion),
          cotizacionUSDT: parseFloat(cotUSDT),
          cotizacionBTC: parseFloat(cotBTC),
          totalUSDT: parseFloat(totalUSDT),
          totalBTC: parseFloat(totalBTC),
          posicionUSDT: parseFloat(posicionUSDT),
          posicionBTC: 0,
          exchange: moneda.exchange,
          decimals: moneda.decimals,
        };
        return elBilletera;
      }
    });
    return concatena.filter(function (dato) {
      return dato != undefined;
    });
  };

  const buscoValor = async () => {
    const miSiglasArr = siglas.split(",");
    const miSiglasCoingecko = miSiglasArr
      .filter((sigla) => sigla.length < 42)
      .join(",");
    const miSiglasBSC = miSiglasArr.filter((sigla) => sigla.length == 42);
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${miSiglasCoingecko}&order=market_cap_desc&per_page=100&page=1&sparkline=false`;

    axios
      .get(url)
      .then((res) => {
        setValores(res.data);
      })
      .catch((err) => console.log(err));

    if (miSiglasBSC) {
      if (valoresBSC.length / miSiglasBSC.length > 3) setValoresBSC([]);
      miSiglasBSC.map((sigla) => {
        consultoAPIBSC(sigla);
      });
    }
  };

  const consultoAPIBSC = (contract) => {
    const busd = "0xe9e7cea3dedca5984780bafc599bd69add087d56";
    //Tengo que buscar los decimales y cantidad en billetera
    let decimales = 18;
    let cantidad = 1;
    const token = billetera.filter((el) => el.id_API === contract);
    if (token.length != 0) {
      decimales = token[0].decimals;
      cantidad = token[0].cantidad;
    }
    const cantidadSinPunto = cantidad.toFixed(18).replace(".", "");
    const url = `https://api.1inch.exchange/v3.0/56/quote?fromTokenAddress=${contract}&toTokenAddress=${busd}&amount=${cantidadSinPunto}`;
    axios
      .get(url)
      .then((res) => {
        const miData = {
          id: contract,
          current_price:
            res.data.toTokenAmount / (1000000000000000000 * cantidad),
        };
        setValoresBSC((prevArray) => [...prevArray, miData]);
      })
      .catch((err) => {
        console.log(err);
        return null;
      });
  };

  const toggleMostrarConCantidad = () => {
    setMostrarConCantidad(!mostrarConCantidad);
  };

  const borrarMoneda = async (index) => {
    const id = billetera[index].id;
    if (!usuario) {
      return router.push("/login");
    }
    try {
      await firebase.db.collection("billetera").doc(id).delete();
    } catch (error) {
      console.log(error);
    }
  };

  const editarMoneda = (index) => {
    const id = billetera[index].id;
    router.push("/editar-monedas[id]", `/editar-monedas/${id}`);
  };

  const ordenesMoneda = (index) => {
    const id = billetera[index].id;
    router.push("/libro-ordenes[id]", `/libro-ordenes/${id}`);
  };

  const comprarMoneda = (index) => {
    const id = billetera[index].id;
    router.push("/comprar-moneda[id]", `/comprar-moneda/${id}`);
  };

  const venderMoneda = (index) => {
    const id = billetera[index].id;
    router.push("/vender-moneda[id]", `/vender-moneda/${id}`);
  };

  const classes = useStyles();

  const columns = [
    {
      name: "id_API",
      options: {
        display: "exclude",
      },
    },
    {
      label: "Sigla",
      name: "sigla",
      options: {
        filter: true,
      },
    },
    {
      label: "Nombre",
      name: "nombre",
      options: {
        filter: true,
      },
    },
    {
      label: "Cantidad",
      name: "cantidad",
      options: {
        filter: false,
        customBodyRenderLite: (dataIndex) => {
          let val = billetera[dataIndex].cantidad;
          return <TableNumberFormat valor={val} decimales={8} estilo={false} />;
        },
      },
    },
    {
      label: "Cotización USDT",
      name: "cotizacionUSDT",
      options: {
        filter: false,
        print: false,
        customBodyRenderLite: (dataIndex) => {
          let val = billetera[dataIndex].cotizacionUSDT;
          return <TableNumberFormat valor={val} decimales={8} estilo={false} />;
        },
      },
    },
    {
      label: "Valor Compra USDT",
      name: "valorcompra",
      options: {
        filter: false,
        sort: true,
        customBodyRenderLite: (dataIndex) => {
          let val = billetera[dataIndex].valorcompra;
          return <TableNumberFormat valor={val} decimales={2} estilo={false} />;
        },
      },
    },
    {
      label: "Valor Actual USDT",
      name: "totalUSDT",
      options: {
        filter: false,
        sort: true,
        customBodyRenderLite: (dataIndex) => {
          let val = billetera[dataIndex].totalUSDT;
          return <TableNumberFormat valor={val} decimales={2} estilo={false} />;
        },
      },
    },
    {
      label: "Posición",
      name: "posicionUSDT",
      options: {
        filter: false,
        sort: true,
        customBodyRenderLite: (dataIndex) => {
          let val = billetera[dataIndex].posicionUSDT;
          return (
            <TableNumberFormat
              valor={val}
              decimales={2}
              estilo={true}
              prefijo={val > 0 && "+"}
              sufijo={"%"}
            />
          );
        },
      },
    },
    {
      label: "Exchange",
      name: "exchange",
      options: {
        filter: true,
        sort: true,
      },
    },
    {
      name: "Acciones",
      options: {
        filter: false,
        sort: false,
        empty: true,
        customBodyRenderLite: (dataIndex, rowIndex) => {
          return (
            <CustomActionsSelect
              dataIndex={dataIndex}
              rowIndex={rowIndex}
              sigla={billetera[dataIndex].sigla}
              borrarMoneda={borrarMoneda}
              editarMoneda={editarMoneda}
              ordenesMoneda={ordenesMoneda}
              comprarMoneda={comprarMoneda}
              venderMoneda={venderMoneda}
            />
          );
        },
      },
    },
  ];

  const options = {
    filter: true,
    filterType: "dropdown",
    responsive: "vertical",
    selectableRowsHeader: false,
    selectableRows: "none",
    rowsSelected: filaSelected,
    rowsPerPage: 25,
    expandableRows: true,
    expandableRowsHeader: false,
    expandableRowsOnClick: false,
    rowsExpanded: filaExpanded,
    isRowExpandable: (dataIndex, expandedRows) => {
      if (
        expandedRows.data.length > 4 &&
        expandedRows.data.filter((d) => d.dataIndex === dataIndex).length === 0
      )
        return false;
      return true;
    },
    renderExpandableRow: (rowData, rowMeta) => {
      const colSpan = rowData.length + 1;
      return (
        <TableRow>
          <TableCell colSpan={colSpan}>
            <Events coin={rowData[0]} />
          </TableCell>
        </TableRow>
      );
    },
    onRowExpansionChange: (curExpanded, allExpanded, rowsExpanded) => {
      const filas = allExpanded.map((fila) => fila.dataIndex);
      setFilaExpanded(filas);
    },
    setTableProps: () => {
      return {
        padding: "default",
        size: "small",
      };
    },
    textLabels: textLabelsSpanish,
    customToolbar: () => {
      return (
        <>
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            onClick={() => router.push("/nueva-moneda")}
          >
            Agregar Moneda
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            onClick={() => router.push("/nueva-moneda-bsc")}
          >
            Agregar Moneda BSC
          </Button>
        </>
      );
    },
    customFooter: (
      count,
      page,
      rowsPerPage,
      changeRowsPerPage,
      changePage,
      textLabels
    ) => {
      return (
        <CustomFooter
          count={count}
          page={page}
          rowsPerPage={rowsPerPage}
          changeRowsPerPage={changeRowsPerPage}
          changePage={changePage}
          textLabels={textLabels}
        />
      );
    },
    customTableBodyFooterRender: function (opts) {
      return (
        <TableFooter className={classes.footerCell}>
          <TableRow>
            {/* {opts.selectableRows !== "none" ? ( */}
            <TableCell className={classes.footerCell} />
            {/* ) : null} */}
            {opts.columns.map((col, index) => {
              if (col.display === "true") {
                if (col.name === "cantidad") {
                  return (
                    <TableCell key={index} className={classes.footerCell}>
                      Totales
                    </TableCell>
                  );
                } else if (col.name === "valorcompra") {
                  return (
                    <TableCell key={index} className={classes.footerCell}>
                      <TableNumberFormat valor={totales.compra} decimales={2} />
                    </TableCell>
                  );
                } else if (col.name === "totalUSDT") {
                  return (
                    <TableCell key={index} className={classes.footerCell}>
                      <TableNumberFormat valor={totales.actual} decimales={2} />
                    </TableCell>
                  );
                } else if (col.name === "posicionUSDT") {
                  return (
                    <TableCell key={index} className={classes.footerCell}>
                      <TableNumberFormat
                        valor={totales.posicion}
                        decimales={2}
                        estilo={true}
                        sufijo={"%"}
                        prefijo={totales.posicion > 0 && "+"}
                      />
                    </TableCell>
                  );
                } else {
                  return (
                    <TableCell key={index} className={classes.footerCell} />
                  );
                }
              }
              return null;
            })}
          </TableRow>
        </TableFooter>
      );
    },
  };

  return (
    <>
      <Paper className={classes.root}>
        <h2>Billetera</h2>
        <FormGroup
          aria-label="position"
          row
          style={{ marginRight: "1rem", marginTop: "2rem" }}
        >
          <FormControlLabel
            value="start"
            labelPlacement="start"
            label="Ocultar monedas sin balance"
            //            style={{ marginRight: "1rem", marginBottom: "1rem" }}
            control={
              <Switch
                size="small"
                checked={mostrarConCantidad}
                onChange={toggleMostrarConCantidad}
              />
            }
          />
        </FormGroup>
        <MUIDataTable
          data={billetera}
          columns={columns}
          options={options}
          // components={{
          //   Tooltip: CustomTooltip,
          // }}
        />
      </Paper>
    </>
  );
}
